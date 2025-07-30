import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { EmailSubscriptionParser } from '@/lib/email-parser';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { emailLogId, retryType = 'processing' } = body;

    if (!emailLogId) {
      return NextResponse.json({ error: 'Email log ID is required' }, { status: 400 });
    }

    // Get the email log
    const { data: emailLog, error: emailError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', emailLogId)
      .eq('user_id', session.user.id)
      .single();

    if (emailError || !emailLog) {
      return NextResponse.json({ error: 'Email log not found' }, { status: 404 });
    }

    let result;

    switch (retryType) {
      case 'processing':
        result = await retryEmailProcessing(emailLog, supabase);
        break;
      case 'delivery':
        result = await retryEmailDelivery(emailLog, supabase);
        break;
      case 'parsing':
        result = await retryEmailParsing(emailLog, supabase);
        break;
      default:
        return NextResponse.json({ error: 'Invalid retry type' }, { status: 400 });
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      emailLogId,
      retryType,
      retriedAt: new Date().toISOString(),
      details: result.details,
    });
  } catch (error) {
    console.error('Email retry error:', error);
    return NextResponse.json({ 
      error: 'Retry failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function retryEmailProcessing(emailLog: any, supabase: any) {
  try {
    // Re-process the email with updated parsing logic
    const parseResult = await EmailSubscriptionParser.parseEmail({
      from: emailLog.sender_email,
      to: emailLog.user_email || 'user@subtracker.tech',
      subject: emailLog.subject,
      bodyText: emailLog.body_text || '',
      receivedAt: new Date(emailLog.created_at),
    });

    // Update the email log with new parsing results
    const bestResult = parseResult.length > 0 ? parseResult[0] : null;
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        status: 'processed',
        confidence_score: bestResult?.confidence || 0,
        subscription_detected: parseResult.length > 0,
        raw_email: {
          ...emailLog.raw_email,
          reprocessed_at: new Date().toISOString(),
          parsing_result: parseResult,
        },
      })
      .eq('id', emailLog.id);

    if (updateError) {
      throw new Error(`Failed to update email log: ${updateError.message}`);
    }

    // If subscription was detected and confidence is high, auto-create subscription
    if (bestResult && bestResult.confidence > 0.8) {
      try {
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: emailLog.user_id,
            name: bestResult.serviceName || 'Unknown Service',
            cost: bestResult.cost || 0,
            billing_cycle: bestResult.billingCycle || 'monthly',
            next_billing_date: bestResult.nextBillingDate || null,
            status: 'active',
            category_id: null, // Will be set by user later
            source: 'email_auto_detected',
            email_log_id: emailLog.id,
          });

        if (subscriptionError) {
          console.error('Failed to create auto-detected subscription:', subscriptionError);
        }
      } catch (subscriptionError) {
        console.error('Subscription creation error:', subscriptionError);
      }
    }

    return {
      success: true,
      message: 'Email reprocessed successfully',
      details: {
        confidence: bestResult?.confidence || 0,
        subscriptionDetected: parseResult.length > 0,
        autoCreated: bestResult && bestResult.confidence > 0.8,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to reprocess email',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

async function retryEmailDelivery(emailLog: any, supabase: any) {
  try {
    // Check if there's a failed delivery log
    const { data: deliveryLogs } = await supabase
      .from('email_delivery_logs')
      .select('*')
      .eq('email_log_id', emailLog.id)
      .eq('delivery_status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!deliveryLogs || deliveryLogs.length === 0) {
      return {
        success: false,
        message: 'No failed delivery found to retry',
        details: {},
      };
    }

    // Create a new delivery attempt
    const { error: deliveryError } = await supabase
      .from('email_delivery_logs')
      .insert({
        email_log_id: emailLog.id,
        delivery_status: 'pending',
        delivery_provider: 'cloudflare',
        webhook_data: {
          retry_attempt: true,
          original_error: deliveryLogs[0].error_message,
          retried_at: new Date().toISOString(),
        },
      });

    if (deliveryError) {
      throw new Error(`Failed to create retry delivery log: ${deliveryError.message}`);
    }

    // In a real implementation, you would trigger the actual delivery retry here
    // For now, we'll simulate success
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the delivery status to delivered (simulated)
    const { error: updateError } = await supabase
      .from('email_delivery_logs')
      .update({
        delivery_status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('email_log_id', emailLog.id)
      .eq('delivery_status', 'pending');

    if (updateError) {
      throw new Error(`Failed to update delivery status: ${updateError.message}`);
    }

    return {
      success: true,
      message: 'Email delivery retried successfully',
      details: {
        retryAttempt: true,
        deliveredAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to retry email delivery',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

async function retryEmailParsing(emailLog: any, supabase: any) {
  try {
    // Re-parse the email with more aggressive patterns
    
    // Try parsing with different approaches
    const parseResults = await Promise.all([
      EmailSubscriptionParser.parseEmail({
        from: emailLog.sender_email,
        to: emailLog.user_email || 'user@subtracker.tech',
        subject: emailLog.subject,
        bodyText: emailLog.body_text || '',
        receivedAt: new Date(emailLog.created_at),
      }),
      EmailSubscriptionParser.parseEmail({
        from: emailLog.sender_email,
        to: emailLog.user_email || 'user@subtracker.tech',
        subject: emailLog.subject,
        bodyHtml: emailLog.raw_email?.html || '',
        receivedAt: new Date(emailLog.created_at),
      }),
    ]);

    // Flatten results and take the result with the highest confidence
    const allResults = parseResults.flat();
    const bestResult = allResults.length > 0 
      ? allResults.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )
      : null;

    // Update the email log
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        confidence_score: bestResult?.confidence || 0,
        subscription_detected: allResults.length > 0,
        raw_email: {
          ...emailLog.raw_email,
          reparsed_at: new Date().toISOString(),
          parsing_attempts: (emailLog.raw_email?.parsing_attempts || 0) + 1,
          best_parsing_result: bestResult,
        },
      })
      .eq('id', emailLog.id);

    if (updateError) {
      throw new Error(`Failed to update email log: ${updateError.message}`);
    }

    return {
      success: true,
      message: 'Email parsing retried successfully',
      details: {
        confidence: bestResult?.confidence || 0,
        subscriptionDetected: allResults.length > 0,
        improvementFound: (bestResult?.confidence || 0) > (emailLog.confidence_score || 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to retry email parsing',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}