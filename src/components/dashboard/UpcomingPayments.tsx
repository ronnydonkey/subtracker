'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

interface UpcomingPayment {
  id: string;
  service_name: string;
  cost: number;
  next_billing_date: string;
  days_until: number;
}

interface Stats {
  upcomingPayments: UpcomingPayment[];
  currency: string;
}

export function UpcomingPayments() {
  const [stats, setStats] = useState<Stats | null>(null);
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
          upcomingPayments: data.upcomingPayments,
          currency: data.currency
        });
      }
    } catch (error) {
      console.error('Failed to fetch upcoming payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
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
        <CardTitle>Upcoming Payments</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.upcomingPayments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No payments due in the next 7 days
          </p>
        ) : (
          <div className="space-y-4">
            {stats.upcomingPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{payment.service_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {payment.days_until === 0 ? 'Today' : 
                     payment.days_until === 1 ? 'Tomorrow' : 
                     `${payment.days_until} days`}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatCurrency(payment.cost, stats.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}