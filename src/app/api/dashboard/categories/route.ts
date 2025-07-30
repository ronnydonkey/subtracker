import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getMonthlyAmount } from '@/lib/utils';

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

    // Get subscriptions grouped by category
    const { data: subscriptionData, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        category:subscription_categories(id, name, color)
      `)
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch subscription data' }, { status: 500 });
    }

    // Group subscriptions by category and calculate totals
    const categoryMap = new Map();
    let totalSpending = 0;

    subscriptionData.forEach(sub => {
      const monthlyAmount = getMonthlyAmount(sub.cost, sub.billing_cycle);
      totalSpending += monthlyAmount;

      const categoryId = sub.category?.id || 'uncategorized';
      const categoryName = sub.category?.name || 'Uncategorized';
      const categoryColor = sub.category?.color || '#6B7280';

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId);
        existing.total += monthlyAmount;
        existing.count += 1;
      } else {
        categoryMap.set(categoryId, {
          id: categoryId,
          name: categoryName,
          color: categoryColor,
          total: monthlyAmount,
          count: 1,
          percentage: 0,
        });
      }
    });

    // Calculate percentages and convert to array
    const categories = Array.from(categoryMap.values()).map(category => ({
      ...category,
      percentage: totalSpending > 0 ? (category.total / totalSpending) * 100 : 0,
    }));

    // Sort by total spending (descending)
    categories.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      categories,
      currency,
      totalSpending,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}