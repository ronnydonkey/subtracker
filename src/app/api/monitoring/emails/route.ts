import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';

    // Calculate time range
    const now = new Date();
    let startTime: Date;
    
    switch (range) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Get email statistics
    const { data: statsData, error: statsError } = await supabase
      .from('email_logs')
      .select(`
        id,
        status,
        email_delivery_logs(delivery_status)
      `)
      .gte('created_at', startTime.toISOString())
      .eq('user_id', session.user.id);

    if (statsError) {
      console.error('Stats query error:', statsError);
      return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: statsData?.length || 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      bounced: 0,
      spam: 0,
    };

    statsData?.forEach((email) => {
      const deliveryLog = email.email_delivery_logs?.[0];
      const deliveryStatus = deliveryLog?.delivery_status || 'pending';
      
      switch (deliveryStatus) {
        case 'delivered':
          stats.delivered++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'bounced':
          stats.bounced++;
          break;
        case 'spam':
          stats.spam++;
          break;
        case 'pending':
        default:
          stats.pending++;
          break;
      }
    });

    // Get recent emails with delivery status
    const { data: recentEmails, error: recentError } = await supabase
      .from('email_logs')
      .select(`
        id,
        sender_email,
        subject,
        status,
        created_at,
        confidence_score,
        subscription_detected,
        email_delivery_logs(
          delivery_status,
          error_message,
          delivered_at
        )
      `)
      .gte('created_at', startTime.toISOString())
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentError) {
      console.error('Recent emails query error:', recentError);
      return NextResponse.json({ error: 'Failed to fetch recent emails' }, { status: 500 });
    }

    // Format recent emails data
    const formattedEmails = recentEmails?.map((email) => {
      const deliveryLog = email.email_delivery_logs?.[0];
      return {
        id: email.id,
        sender_email: email.sender_email,
        subject: email.subject,
        received_at: email.created_at,
        status: email.status,
        delivery_status: deliveryLog?.delivery_status,
        error_message: deliveryLog?.error_message,
        subscription_detected: email.subscription_detected,
        confidence_score: email.confidence_score,
      };
    }) || [];

    return NextResponse.json({
      stats,
      recentEmails: formattedEmails,
      lastUpdated: new Date().toISOString(),
      timeRange: range,
    });
  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch monitoring data',
      stats: { total: 0, delivered: 0, failed: 0, pending: 0, bounced: 0, spam: 0 },
      recentEmails: [],
      lastUpdated: new Date().toISOString(),
    }, { status: 500 });
  }
}