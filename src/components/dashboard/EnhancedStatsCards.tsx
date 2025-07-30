'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import {
  CurrencyDollarIcon,
  CreditCardIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface EnhancedStats {
  monthlyTotal: number;
  yearlyTotal: number;
  currentMonthSpent: number;
  activeSubscriptions: number;
  currency: string;
  monthOverMonthChange: number;
  nextPayment: {
    days: number;
    service: string;
    amount: number;
  } | null;
}

export function EnhancedStatsCards() {
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/enhanced-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const isPositiveChange = stats.monthOverMonthChange > 0;
  const ChangeIcon = isPositiveChange ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  const changeColor = isPositiveChange ? 'text-red-600' : 'text-green-600';

  const statCards = [
    {
      title: 'Total Monthly Cost',
      value: formatCurrency(stats.monthlyTotal, stats.currency),
      description: (
        <div className="flex items-center gap-1">
          <ChangeIcon className={`h-3 w-3 ${changeColor}`} />
          <span className={changeColor}>
            {Math.abs(stats.monthOverMonthChange)}%
          </span>
          <span className="text-gray-500 dark:text-gray-400">from last month</span>
        </div>
      ),
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions.toString(),
      description: 'currently active',
      icon: CreditCardIcon,
      color: 'text-blue-600',
    },
    {
      title: 'This Month',
      value: formatCurrency(stats.currentMonthSpent, stats.currency),
      description: 'total spent this month',
      icon: CurrencyDollarIcon,
      color: 'text-purple-600',
    },
    {
      title: 'Next Payment',
      value: stats.nextPayment ? `${stats.nextPayment.days} days` : 'None',
      description: stats.nextPayment 
        ? `${stats.nextPayment.service} renewal`
        : 'No upcoming payments',
      icon: CalendarIcon,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {typeof stat.description === 'string' ? (
                stat.description
              ) : (
                stat.description
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}