'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

interface QuickStatsData {
  mostExpensive: {
    service_name: string;
    monthly_cost: number;
  } | null;
  cheapest: {
    service_name: string;
    monthly_cost: number;
  } | null;
  averagePerMonth: number;
  currency: string;
}

export function QuickStats() {
  const [stats, setStats] = useState<QuickStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/enhanced-stats');
      if (response.ok) {
        const data = await response.json();
        setStats({
          mostExpensive: data.mostExpensive,
          cheapest: data.cheapest,
          averagePerMonth: data.averagePerMonth,
          currency: data.currency
        });
      }
    } catch (error) {
      console.error('Failed to fetch quick stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-1" />
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.mostExpensive && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Most Expensive</p>
            <p className="font-semibold">{stats.mostExpensive.service_name}</p>
            <p className="text-sm">{formatCurrency(stats.mostExpensive.monthly_cost, stats.currency)}/month</p>
          </div>
        )}
        
        {stats.cheapest && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cheapest</p>
            <p className="font-semibold">{stats.cheapest.service_name}</p>
            <p className="text-sm">{formatCurrency(stats.cheapest.monthly_cost, stats.currency)}/month</p>
          </div>
        )}
        
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg. per month</p>
          <p className="font-semibold">{formatCurrency(stats.averagePerMonth, stats.currency)}</p>
        </div>
      </CardContent>
    </Card>
  );
}