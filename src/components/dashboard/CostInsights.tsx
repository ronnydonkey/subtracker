'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  CalendarIcon 
} from '@heroicons/react/24/outline';

interface CostInsight {
  totalMonthly: number;
  totalYearly: number;
  projectedFiveYear: number;
  averageCostPerService: number;
  mostExpensiveCategory: {
    name: string;
    cost: number;
  } | null;
  yearOverYearGrowth: number;
  currency: string;
}

export function CostInsights() {
  const [insights, setInsights] = useState<CostInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCostInsights();
  }, []);

  const fetchCostInsights = async () => {
    try {
      const response = await fetch('/api/dashboard/cost-insights');
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Failed to fetch cost insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Cost Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5" />
          Cost Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <CalendarIcon className="h-4 w-4" />
              Annual Total
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(insights.totalYearly, insights.currency)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(insights.totalMonthly, insights.currency)}/month
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <ArrowTrendingUpIcon className="h-4 w-4" />
              5-Year Cost
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(insights.projectedFiveYear, insights.currency)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              If you keep all subscriptions
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <CurrencyDollarIcon className="h-4 w-4" />
              Avg per Service
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(insights.averageCostPerService, insights.currency)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Monthly average
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <ChartBarIcon className="h-4 w-4" />
              Top Category
            </div>
            <div className="text-lg font-bold">
              {insights.mostExpensiveCategory?.name || 'None'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {insights.mostExpensiveCategory 
                ? formatCurrency(insights.mostExpensiveCategory.cost, insights.currency) + '/mo'
                : 'No data'
              }
            </div>
          </div>
        </div>

        {insights.yearOverYearGrowth !== 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Spending Trend
              </span>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Your subscription costs have {insights.yearOverYearGrowth > 0 ? 'increased' : 'decreased'} by{' '}
              <span className="font-semibold">
                {Math.abs(insights.yearOverYearGrowth).toFixed(1)}%
              </span>{' '}
              compared to last year
            </p>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          💡 Tip: Review your most expensive subscriptions quarterly to ensure you're getting value
        </div>
      </CardContent>
    </Card>
  );
}