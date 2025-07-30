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

    // Get email processing statistics
    const { data: stats, error } = await supabase
      .from('email_processing_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch email stats' }, { status: 500 });
    }

    // If no stats found, return zero values
    const defaultStats = {
      total_emails: 0,
      processed_emails: 0,
      error_emails: 0,
      spam_emails: 0,
      total_detections: 0,
      approved_detections: 0,
      pending_detections: 0,
      last_email_received: null,
    };

    return NextResponse.json(stats || defaultStats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}