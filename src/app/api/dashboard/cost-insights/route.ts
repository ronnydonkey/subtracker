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

    // Get all active subscriptions with categories
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        category:subscription_categories(name, color)
      `)
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Calculate totals
    let totalMonthly = 0;
    let totalYearly = 0;
    const categoryTotals: { [key: string]: number } = {};

    subscriptions.forEach(sub => {
      const monthly = getMonthlyAmount(sub.cost, sub.billing_cycle);
      const yearly = getYearlyAmount(sub.cost, sub.billing_cycle);
      
      totalMonthly += monthly;
      totalYearly += yearly;

      // Track category spending
      const categoryName = sub.category?.name || 'Other';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + monthly;
    });

    // Find most expensive category
    let mostExpensiveCategory = null;
    let maxCategoryCost = 0;
    
    for (const [name, cost] of Object.entries(categoryTotals)) {
      if (cost > maxCategoryCost) {
        maxCategoryCost = cost;
        mostExpensiveCategory = { name, cost };
      }
    }

    // Calculate average cost per service
    const averageCostPerService = subscriptions.length > 0 ? totalMonthly / subscriptions.length : 0;

    // Calculate 5-year projection (assuming current costs)
    const projectedFiveYear = totalYearly * 5;

    // Get historical data for year-over-year growth
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: historicalData } = await supabase
      .from('subscription_history')
      .select('old_data, new_data, created_at')
      .eq('user_id', session.user.id)
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: true });

    // Calculate year-over-year growth (simplified)
    let yearOverYearGrowth = 0;
    if (historicalData && historicalData.length > 0) {
      // This is a simplified calculation - in a real app you'd want more sophisticated historical tracking
      const oldestRecord = historicalData[0];
      const newestRecord = historicalData[historicalData.length - 1];
      
      if (oldestRecord.old_data && newestRecord.new_data) {
        const oldCost = parseFloat(oldestRecord.old_data.cost) || 0;
        const newCost = parseFloat(newestRecord.new_data.cost) || 0;
        
        if (oldCost > 0) {
          yearOverYearGrowth = ((newCost - oldCost) / oldCost) * 100;
        }
      }
    }

    const insights = {
      totalMonthly,
      totalYearly,
      projectedFiveYear,
      averageCostPerService,
      mostExpensiveCategory,
      yearOverYearGrowth,
      currency,
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}