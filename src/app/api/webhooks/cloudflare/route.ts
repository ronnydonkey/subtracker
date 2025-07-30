import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { EmailSubscriptionParser, type EmailData } from '@/lib/email-parser';
import { rateLimit } from '@/lib/rate-limit';

// Rate limiting for Cloudflare webhooks
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 1000,
});

interface CloudflareEmailPayload {
  from: string;
  to: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
  messageId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'cloudflare';
    const { success, limit, reset, remaining } = await limiter.check(identifier, 200);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }

    // Verify Cloudflare webhook
    const isCloudflareWorker = request.headers.get('x-cloudflare-worker') === 'true';
    const webhookSecret = request.headers.get('x-webhook-secret');
    
    if (!isCloudflareWorker || webhookSecret !== process.env.CLOUDFLARE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CloudflareEmailPayload = await request.json();
    
    // Validate payload
    if (!body.from || !body.to || !body.subject) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Convert to standard email format
    const emailData: EmailData = {
      from: body.from,
      to: body.to,
      subject: body.subject,
      bodyText: body.body,
      bodyHtml: body.headers['content-type']?.includes('text/html') ? body.body : undefined,
      receivedAt: new Date(body.timestamp || Date.now()),
      messageId: body.messageId || body.headers['message-id'],
      headers: body.headers,
    };

    // Process the email
    const result = await processCloudflareEmail(emailData);
    
    return NextResponse.json({
      processed: true,
      ...result,
      success: true,
    });
  } catch (error) {
    console.error('Cloudflare webhook error:', error);
    
    // Log error for monitoring
    try {
      await logWebhookError(error, request);
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

async function processCloudflareEmail(emailData: EmailData) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Find the user email address
    const { data: userEmail, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('email_address', emailData.to)
      .eq('is_active', true)
      .single();

    if (emailError || !userEmail) {
      // Log unknown email address
      await logUnknownEmail(emailData);
      return { 
        success: false, 
        error: 'Email address not found or inactive',
        action: 'logged_unknown'
      };
    }

    // Log the incoming email
    const { data: emailLog, error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_email_id: userEmail.id,
        user_id: userEmail.user_id,
        sender_email: emailData.from,
        subject: emailData.subject,
        body_text: emailData.bodyText,
        body_html: emailData.bodyHtml,
        received_at: emailData.receivedAt.toISOString(),
        raw_email: {
          ...emailData,
          source: 'cloudflare',
          processed_at: new Date().toISOString(),
        },
        status: 'pending',
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to log email: ${logError.message}`);
    }

    // Update user email stats
    await supabase
      .from('user_emails')
      .update({
        total_received: userEmail.total_received + 1,
        last_email_at: emailData.receivedAt.toISOString(),
      })
      .eq('id', userEmail.id);

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userEmail.user_id)
      .single();

    let detectedSubscriptionIds: string[] = [];
    let detectionsCount = 0;

    // Parse email for subscription patterns (if auto-detection enabled)
    if (preferences?.auto_detection !== false) {
      try {
        const detections = await EmailSubscriptionParser.parseEmail(emailData);
        detectionsCount = detections.length;

        // Save detected subscriptions
        if (detections.length > 0) {
          for (const detection of detections) {
            const { data: detectedSub, error: detectionError } = await supabase
              .from('detected_subscriptions')
              .insert({
                email_log_id: emailLog.id,
                user_id: userEmail.user_id,
                service_name: detection.serviceName,
                cost: detection.cost,
                currency: detection.currency || 'USD',
                billing_cycle: detection.billingCycle,
                trial_end_date: detection.trialEndDate?.toISOString(),
                next_billing_date: detection.nextBillingDate?.toISOString(),
                confidence_score: detection.confidence,
                detection_type: detection.detectionType,
                extracted_data: {
                  ...detection.extractedData,
                  source: 'cloudflare',
                },
                status: detection.confidence > 0.8 ? 'auto_added' : 'pending',
              })
              .select()
              .single();

            if (!detectionError && detectedSub) {
              detectedSubscriptionIds.push(detectedSub.id);

              // Auto-add high-confidence detections
              if (detection.confidence > 0.8) {
                await autoAddSubscription(supabase, detectedSub, userEmail.user_id);
              }
            }
          }

          // Update email log with detection flag
          await supabase
            .from('email_logs')
            .update({
              subscription_detected: true,
              status: 'processed',
              processed_at: new Date().toISOString(),
            })
            .eq('id', emailLog.id);

          // Send notification if subscriptions detected
          if (preferences?.forward_to_email) {
            try {
              const notificationContent = createDetectionNotification(detections, emailData.from);
              console.log('Would send notification to:', preferences.forward_to_email, notificationContent);
              // TODO: Implement notification sending when needed
            } catch (notificationError) {
              console.error('Notification sending failed:', notificationError);
            }
          }
        } else {
          // Mark as processed with no detections
          await supabase
            .from('email_logs')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString(),
            })
            .eq('id', emailLog.id);
        }
      } catch (parseError) {
        console.error('Email parsing failed:', parseError);
        
        // Mark as error but don't fail the entire process
        await supabase
          .from('email_logs')
          .update({
            status: 'error',
            error_message: parseError instanceof Error ? parseError.message : String(parseError),
            processed_at: new Date().toISOString(),
          })
          .eq('id', emailLog.id);
      }
    } else {
      // Auto-detection disabled, just mark as processed
      await supabase
        .from('email_logs')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', emailLog.id);
    }

    // Forward email if enabled
    let forwarded = false;
    if (preferences?.email_forwarding && preferences?.forward_to_email) {
      try {
        console.log('Would forward email to:', preferences.forward_to_email, 'from:', emailData.from);
        // TODO: Implement email forwarding when needed
        forwarded = true;
      } catch (forwardError) {
        console.error('Email forwarding failed:', forwardError);
        // Don't fail the entire process if forwarding fails
      }
    }

    return {
      success: true,
      emailLogId: emailLog.id,
      detectionsCount,
      detectedSubscriptionIds,
      forwarded,
      userId: userEmail.user_id,
    };
  } catch (error) {
    console.error('Cloudflare email processing error:', error);
    throw error;
  }
}

async function autoAddSubscription(supabase: any, detectedSub: any, userId: string) {
  try {
    // Find a suitable category
    const { data: categories } = await supabase
      .from('subscription_categories')
      .select('*')
      .order('name');

    let categoryId = null;
    if (categories && categories.length > 0) {
      const serviceName = detectedSub.service_name.toLowerCase();
      
      if (serviceName.includes('netflix') || serviceName.includes('spotify') || serviceName.includes('disney')) {
        categoryId = categories.find((c: any) => c.name === 'Entertainment')?.id;
      } else if (serviceName.includes('slack') || serviceName.includes('notion') || serviceName.includes('zoom')) {
        categoryId = categories.find((c: any) => c.name === 'Productivity')?.id;
      } else if (serviceName.includes('dropbox') || serviceName.includes('google') || serviceName.includes('icloud')) {
        categoryId = categories.find((c: any) => c.name === 'Cloud Storage')?.id;
      }
      
      if (!categoryId) {
        categoryId = categories.find((c: any) => c.name === 'Other')?.id;
      }
    }

    const subscriptionData = {
      user_id: userId,
      service_name: detectedSub.service_name,
      category_id: categoryId,
      cost: detectedSub.cost || 0,
      currency: detectedSub.currency || 'USD',
      billing_cycle: detectedSub.billing_cycle || 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      next_billing_date: detectedSub.next_billing_date || new Date().toISOString().split('T')[0],
      trial_end_date: detectedSub.trial_end_date,
      status: detectedSub.trial_end_date ? 'trial' : 'active',
      auto_renew: true,
      description: `Auto-detected from Cloudflare email (${detectedSub.detection_type})`,
      confidence_score: detectedSub.confidence_score,
      source_email: { 
        detectedSubscriptionId: detectedSub.id,
        source: 'cloudflare',
      },
    };

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (!error && subscription) {
      await supabase
        .from('detected_subscriptions')
        .update({ subscription_id: subscription.id })
        .eq('id', detectedSub.id);
    }
  } catch (error) {
    console.error('Auto-add subscription failed:', error);
  }
}

function createDetectionNotification(detections: any[], sender: string): string {
  const detectionList = detections.map(d => 
    `• ${d.serviceName} (${d.detectionType.replace('_', ' ')}) - Confidence: ${Math.round(d.confidence * 100)}%`
  ).join('<br>');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
      <h2 style="color: #1f2937;">🎯 New Subscription Detected via Cloudflare</h2>
      <p>SubTracker has detected potential subscription activity from <strong>${sender}</strong>:</p>
      
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${detectionList}
      </div>
      
      <p>
        <a href="https://subtracker.app/email" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Review Detections
        </a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        Processed via Cloudflare Email Routing. You can manage your email preferences in your SubTracker dashboard.
      </p>
    </div>
  `;
}

async function logUnknownEmail(emailData: EmailData) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    await supabase
      .from('email_logs')
      .insert({
        user_email_id: null,
        user_id: null,
        sender_email: emailData.from,
        subject: emailData.subject,
        body_text: emailData.bodyText?.substring(0, 1000), // Truncate for unknown emails
        received_at: emailData.receivedAt.toISOString(),
        status: 'ignored',
        error_message: 'Unknown email address',
        raw_email: {
          ...emailData,
          source: 'cloudflare',
          action: 'ignored_unknown',
        },
      });
  } catch (error) {
    console.error('Failed to log unknown email:', error);
  }
}

async function logWebhookError(error: any, request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    await supabase
      .from('email_logs')
      .insert({
        user_email_id: null,
        user_id: null,
        sender_email: 'webhook-error',
        subject: 'Cloudflare Webhook Error',
        body_text: error.message || String(error),
        received_at: new Date().toISOString(),
        status: 'error',
        error_message: error.message || String(error),
        raw_email: {
          source: 'cloudflare',
          error: true,
          timestamp: Date.now(),
          headers: Object.fromEntries(request.headers.entries()),
        },
      });
  } catch (logError) {
    console.error('Failed to log webhook error:', logError);
  }
}