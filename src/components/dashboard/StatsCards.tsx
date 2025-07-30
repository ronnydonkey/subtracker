'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import {
  CurrencyDollarIcon,
  CreditCardIcon,
  BeakerIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface Stats {
  monthlyTotal: number;
  yearlyTotal: number;
  activeSubscriptions: number;
  trialCount: number;
  upcomingPayments: number;
  currency: string;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
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

  const statCards = [
    {
      title: 'Monthly Total',
      value: formatCurrency(stats.monthlyTotal, stats.currency),
      description: `${formatCurrency(stats.yearlyTotal, stats.currency)} per year`,
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions.toString(),
      description: 'Currently active',
      icon: CreditCardIcon,
      color: 'text-blue-600',
    },
    {
      title: 'Free Trials',
      value: stats.trialCount.toString(),
      description: 'Active trials',
      icon: BeakerIcon,
      color: 'text-purple-600',
    },
    {
      title: 'Upcoming Payments',
      value: stats.upcomingPayments.toString(),
      description: 'Next 7 days',
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}