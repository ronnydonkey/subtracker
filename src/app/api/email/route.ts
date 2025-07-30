import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { EmailSubscriptionParser, type EmailData } from '@/lib/email-parser';
import { EmailForwarder } from '@/lib/email-forwarder';
import { rateLimit } from '@/lib/rate-limit';

// Rate limiting for email processing
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Limit each unique token to 500 requests per interval
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const { success, limit, reset, remaining } = await limiter.check(identifier, 100); // 100 requests per minute
    
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

    // Verify webhook signature if configured
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature');
      if (!signature || !verifyWebhookSignature(signature, await request.text(), webhookSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = await request.json();
    
    // Validate email data
    const emailData = validateEmailData(body);
    if (!emailData) {
      return NextResponse.json({ error: 'Invalid email data' }, { status: 400 });
    }

    // Process the email
    const result = await processIncomingEmail(emailData);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Email processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function validateEmailData(body: any): EmailData | null {
  try {
    // Support multiple webhook formats (SendGrid, Mailgun, etc.)
    let emailData: EmailData;

    if (body.envelope && body.plain) {
      // Mailgun format
      emailData = {
        from: body.sender,
        to: body.recipient,
        subject: body.subject,
        bodyText: body.plain,
        bodyHtml: body.html,
        receivedAt: new Date(body.timestamp * 1000),
        messageId: body['message-id'],
        headers: body.headers || {},
      };
    } else if (body.from && body.to) {
      // Generic format
      emailData = {
        from: body.from,
        to: body.to,
        subject: body.subject,
        bodyText: body.text || body.bodyText,
        bodyHtml: body.html || body.bodyHtml,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        messageId: body.messageId,
        headers: body.headers || {},
      };
    } else {
      return null;
    }

    // Validate required fields
    if (!emailData.from || !emailData.to || !emailData.subject) {
      return null;
    }

    return emailData;
  } catch (error) {
    console.error('Email validation error:', error);
    return null;
  }
}

function verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
  try {
    const crypto = require('crypto');
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${computedSignature}`)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function processIncomingEmail(emailData: EmailData) {
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
      return { success: false, error: 'Email address not found or inactive' };
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
        raw_email: emailData,
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

    // Parse email for subscription patterns
    const detections = await EmailSubscriptionParser.parseEmail(emailData);
    
    let detectedSubscriptionIds: string[] = [];

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
            extracted_data: detection.extractedData,
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

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('email_forwarding, forward_to_email')
      .eq('user_id', userEmail.user_id)
      .single();

    // Forward email if enabled
    if (preferences?.email_forwarding && preferences?.forward_to_email) {
      try {
        await EmailForwarder.forwardEmail({
          to: preferences.forward_to_email,
          from: emailData.from,
          subject: emailData.subject,
          bodyText: emailData.bodyText,
          bodyHtml: emailData.bodyHtml,
          originalSender: emailData.from,
          receivedAt: emailData.receivedAt,
        });
      } catch (forwardError) {
        console.error('Email forwarding failed:', forwardError);
        // Don't fail the entire process if forwarding fails
      }
    }

    // Send notification if subscriptions detected
    if (detections.length > 0 && preferences?.forward_to_email) {
      try {
        const notificationContent = createDetectionNotification(detections, emailData.from);
        await EmailForwarder.sendNotification(
          preferences.forward_to_email,
          'New subscription detected',
          notificationContent,
          true
        );
      } catch (notificationError) {
        console.error('Notification sending failed:', notificationError);
      }
    }

    return {
      success: true,
      emailLogId: emailLog.id,
      detectionsCount: detections.length,
      detectedSubscriptionIds,
      forwarded: !!preferences?.email_forwarding,
    };
  } catch (error) {
    console.error('Email processing error:', error);
    
    // Update email log with error
    try {
      await supabase
        .from('email_logs')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString(),
        })
        .eq('user_email_id', emailData.to);
    } catch (updateError) {
      console.error('Failed to update email log with error:', updateError);
    }

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
      // Simple category matching based on service name
      const serviceName = detectedSub.service_name.toLowerCase();
      
      if (serviceName.includes('netflix') || serviceName.includes('spotify') || serviceName.includes('disney')) {
        categoryId = categories.find((c: any) => c.name === 'Entertainment')?.id;
      } else if (serviceName.includes('slack') || serviceName.includes('notion') || serviceName.includes('zoom')) {
        categoryId = categories.find((c: any) => c.name === 'Productivity')?.id;
      } else if (serviceName.includes('dropbox') || serviceName.includes('google') || serviceName.includes('icloud')) {
        categoryId = categories.find((c: any) => c.name === 'Cloud Storage')?.id;
      }
      
      // Default to 'Other' if no match
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
      description: `Auto-detected from email (${detectedSub.detection_type})`,
      confidence_score: detectedSub.confidence_score,
      source_email: { detectedSubscriptionId: detectedSub.id },
    };

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (!error && subscription) {
      // Link the detection to the created subscription
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
      <h2 style="color: #1f2937;">🎯 New Subscription Detected</h2>
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
        You can manage your email preferences and review detected subscriptions in your SubTracker dashboard.
      </p>
    </div>
  `;
}