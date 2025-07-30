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
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('detected_subscriptions')
      .select(`
        *,
        email_log:email_logs(sender_email, subject, received_at)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch detections' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // First, get the detection to ensure it belongs to the user
    const { data: detection, error: fetchError } = await supabase
      .from('detected_subscriptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !detection) {
      return NextResponse.json({ error: 'Detection not found' }, { status: 404 });
    }

    // Update the detection status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString();
    }

    const { data: updatedDetection, error: updateError } = await supabase
      .from('detected_subscriptions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update detection' }, { status: 500 });
    }

    // If approved, create a subscription
    if (status === 'approved') {
      await createSubscriptionFromDetection(supabase, detection, session.user.id);
    }

    return NextResponse.json(updatedDetection);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createSubscriptionFromDetection(supabase: any, detection: any, userId: string) {
  try {
    // Find a suitable category
    const { data: categories } = await supabase
      .from('subscription_categories')
      .select('*')
      .order('name');

    let categoryId = null;
    if (categories && categories.length > 0) {
      // Simple category matching based on service name
      const serviceName = detection.service_name.toLowerCase();
      
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
      service_name: detection.service_name,
      category_id: categoryId,
      cost: detection.cost || 0,
      currency: detection.currency || 'USD',
      billing_cycle: detection.billing_cycle || 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      next_billing_date: detection.next_billing_date || new Date().toISOString().split('T')[0],
      trial_end_date: detection.trial_end_date,
      status: detection.trial_end_date ? 'trial' : 'active',
      auto_renew: true,
      description: `Created from email detection (${detection.detection_type})`,
      confidence_score: detection.confidence_score,
      source_email: { detectedSubscriptionId: detection.id },
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
        .eq('id', detection.id);

      // Log the creation in subscription history
      await supabase
        .from('subscription_history')
        .insert({
          subscription_id: subscription.id,
          user_id: userId,
          action: 'created_from_detection',
          new_data: subscriptionData,
        });
    }

    return subscription;
  } catch (error) {
    console.error('Failed to create subscription from detection:', error);
    throw error;
  }
}