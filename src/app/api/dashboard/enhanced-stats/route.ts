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

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    const currency = preferences?.currency || 'USD';

    // Get all subscriptions with categories
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        category:subscription_categories(name, color)
      `)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Filter subscriptions by status
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    const trialSubscriptions = subscriptions.filter(sub => sub.status === 'trial');
    
    // Calculate monthly and yearly totals
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    let currentMonthSpent = 0;
    
    activeSubscriptions.forEach(sub => {
      const monthly = getMonthlyAmount(sub.cost, sub.billing_cycle);
      const yearly = getYearlyAmount(sub.cost, sub.billing_cycle);
      monthlyTotal += monthly;
      yearlyTotal += yearly;

      // Check if subscription was billed this month
      const lastBilling = new Date(sub.next_billing_date);
      lastBilling.setMonth(lastBilling.getMonth() - getBillingCycleMonths(sub.billing_cycle));
      
      const currentMonth = new Date();
      if (lastBilling.getMonth() === currentMonth.getMonth() && 
          lastBilling.getFullYear() === currentMonth.getFullYear()) {
        currentMonthSpent += sub.cost;
      }
    });

    // Get previous month's total for comparison
    const { data: previousMonthData } = await supabase
      .rpc('get_previous_month_total', { user_uuid: session.user.id });
    
    const previousMonthTotal = previousMonthData?.[0]?.total || monthlyTotal;
    const monthOverMonthChange = previousMonthTotal > 0 
      ? ((monthlyTotal - previousMonthTotal) / previousMonthTotal * 100).toFixed(1)
      : 0;

    // Find next payment
    const nextPayment = activeSubscriptions
      .filter(sub => sub.next_billing_date)
      .sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())
      .find(sub => new Date(sub.next_billing_date) >= new Date());

    let nextPaymentDays = null;
    let nextPaymentService = null;
    let nextPaymentAmount = null;
    
    if (nextPayment) {
      const daysUntil = Math.ceil((new Date(nextPayment.next_billing_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      nextPaymentDays = daysUntil;
      nextPaymentService = nextPayment.service_name;
      nextPaymentAmount = nextPayment.cost;
    }

    // Get upcoming payments (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const upcomingPayments = activeSubscriptions
      .filter(sub => {
        const nextBilling = new Date(sub.next_billing_date);
        return nextBilling <= sevenDaysFromNow && nextBilling >= new Date();
      })
      .map(sub => ({
        id: sub.id,
        service_name: sub.service_name,
        cost: sub.cost,
        next_billing_date: sub.next_billing_date,
        days_until: Math.ceil((new Date(sub.next_billing_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => a.days_until - b.days_until);

    // Get trials ending soon
    const { data: trialsEndingSoon } = await supabase
      .rpc('get_trials_ending_soon', { 
        user_uuid: session.user.id,
        days_ahead: 7
      });

    // Get unused subscriptions
    const { data: unusedSubscriptions } = await supabase
      .rpc('get_unused_subscriptions', { 
        user_uuid: session.user.id,
        days_threshold: 30
      });

    // Find most expensive and cheapest active subscriptions
    const sortedByPrice = activeSubscriptions
      .filter(sub => sub.cost > 0)
      .sort((a, b) => {
        const aMonthly = getMonthlyAmount(a.cost, a.billing_cycle);
        const bMonthly = getMonthlyAmount(b.cost, b.billing_cycle);
        return bMonthly - aMonthly;
      });

    const mostExpensive = sortedByPrice[0] || null;
    const cheapest = sortedByPrice[sortedByPrice.length - 1] || null;

    // Check budget status
    let budgetStatus = null;
    if (preferences?.monthly_budget_limit) {
      const percentageUsed = (monthlyTotal / preferences.monthly_budget_limit) * 100;
      budgetStatus = {
        limit: preferences.monthly_budget_limit,
        used: monthlyTotal,
        percentage: Math.round(percentageUsed),
        exceeded: percentageUsed > 100,
        alert_threshold: preferences.budget_alert_threshold || 80
      };
    }

    const stats = {
      // Core stats
      monthlyTotal,
      yearlyTotal,
      currentMonthSpent,
      activeSubscriptions: activeSubscriptions.length,
      trialCount: trialSubscriptions.length,
      currency,
      
      // Enhanced stats
      monthOverMonthChange,
      nextPayment: nextPaymentDays !== null ? {
        days: nextPaymentDays,
        service: nextPaymentService,
        amount: nextPaymentAmount
      } : null,
      
      // Lists
      upcomingPayments,
      trialsEndingSoon: trialsEndingSoon || [],
      unusedSubscriptions: unusedSubscriptions || [],
      
      // Quick stats
      mostExpensive: mostExpensive ? {
        service_name: mostExpensive.service_name,
        monthly_cost: getMonthlyAmount(mostExpensive.cost, mostExpensive.billing_cycle)
      } : null,
      cheapest: cheapest ? {
        service_name: cheapest.service_name,
        monthly_cost: getMonthlyAmount(cheapest.cost, cheapest.billing_cycle)
      } : null,
      averagePerMonth: activeSubscriptions.length > 0 ? monthlyTotal / activeSubscriptions.length : 0,
      
      // Budget
      budgetStatus
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getBillingCycleMonths(cycle: string): number {
  switch (cycle) {
    case 'weekly': return 0.25;
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'semi-annually': return 6;
    case 'annually': return 12;
    default: return 1;
  }
}