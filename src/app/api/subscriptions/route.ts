import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { subscriptionSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const sort = searchParams.get('sort') || 'created_at';
    const status = searchParams.get('status');
    const endingSoon = searchParams.get('ending_soon');

    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        category:subscription_categories(name, color)
      `)
      .eq('user_id', session.user.id);

    if (status) {
      query = query.eq('status', status);
    }

    if (endingSoon === 'true') {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      query = query
        .not('trial_end_date', 'is', null)
        .lte('trial_end_date', sevenDaysFromNow.toISOString());
    }

    if (sort === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order(sort);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate the request body
    const validationResult = subscriptionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const subscriptionData = {
      user_id: session.user.id,
      service_name: body.serviceName,
      category_id: body.categoryId || null,
      cost: body.cost,
      currency: body.currency,
      billing_cycle: body.billingCycle,
      start_date: body.startDate,
      next_billing_date: body.nextBillingDate,
      end_date: body.endDate || null,
      trial_end_date: body.trialEndDate || null,
      status: body.status,
      auto_renew: body.autoRenew,
      description: body.description || null,
      website_url: body.websiteUrl || null,
      cancellation_url: body.cancellationUrl || null,
      notification_days_before: body.notificationDaysBefore,
    };

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Log the creation in subscription history
    await supabase
      .from('subscription_history')
      .insert({
        subscription_id: data.id,
        user_id: session.user.id,
        action: 'created',
        new_data: subscriptionData,
      });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}