import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getMonthlyAmount, getYearlyAmount } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user preferences for currency
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('currency')
      .eq('user_id', session.user.id)
      .single();

    const currency = preferences?.currency || 'USD';

    // Get all subscriptions for the user
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Calculate statistics
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    const trialSubscriptions = subscriptions.filter(sub => sub.status === 'trial');
    
    // Calculate monthly and yearly totals
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    
    activeSubscriptions.forEach(sub => {
      const monthly = getMonthlyAmount(sub.cost, sub.billing_cycle);
      const yearly = getYearlyAmount(sub.cost, sub.billing_cycle);
      monthlyTotal += monthly;
      yearlyTotal += yearly;
    });

    // Count upcoming payments (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const upcomingPayments = activeSubscriptions.filter(sub => {
      const nextBilling = new Date(sub.next_billing_date);
      return nextBilling <= sevenDaysFromNow && nextBilling >= new Date();
    }).length;

    const stats = {
      monthlyTotal,
      yearlyTotal,
      activeSubscriptions: activeSubscriptions.length,
      trialCount: trialSubscriptions.length,
      upcomingPayments,
      currency,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}