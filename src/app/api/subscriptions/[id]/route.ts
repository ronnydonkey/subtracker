import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { updateSubscriptionSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        category:subscription_categories(id, name, color)
      `)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, check if the subscription exists and belongs to the user
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    const body = await request.json();
    
    // Validate the request body
    const validationResult = updateSubscriptionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    // Only include fields that are provided in the request
    if (body.serviceName !== undefined) updateData.service_name = body.serviceName;
    if (body.categoryId !== undefined) updateData.category_id = body.categoryId || null;
    if (body.cost !== undefined) updateData.cost = body.cost;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.billingCycle !== undefined) updateData.billing_cycle = body.billingCycle;
    if (body.startDate !== undefined) updateData.start_date = body.startDate;
    if (body.nextBillingDate !== undefined) updateData.next_billing_date = body.nextBillingDate;
    if (body.endDate !== undefined) updateData.end_date = body.endDate || null;
    if (body.trialEndDate !== undefined) updateData.trial_end_date = body.trialEndDate || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.autoRenew !== undefined) updateData.auto_renew = body.autoRenew;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.websiteUrl !== undefined) updateData.website_url = body.websiteUrl || null;
    if (body.cancellationUrl !== undefined) updateData.cancellation_url = body.cancellationUrl || null;
    if (body.notificationDaysBefore !== undefined) updateData.notification_days_before = body.notificationDaysBefore;

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    // Log the update in subscription history
    await supabase
      .from('subscription_history')
      .insert({
        subscription_id: id,
        user_id: session.user.id,
        action: 'updated',
        old_data: existingSubscription,
        new_data: data,
      });

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, get the subscription data for history logging
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    // Log the deletion in subscription history before deleting
    await supabase
      .from('subscription_history')
      .insert({
        subscription_id: id,
        user_id: session.user.id,
        action: 'deleted',
        old_data: existingSubscription,
      });

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}