'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, getMonthlyAmount } from '@/lib/utils';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface UnusedSubscription {
  subscription_id: string;
  service_name: string;
  cost: number;
  billing_cycle: string;
  last_used_at: string | null;
  days_unused: number;
}

interface UnusedData {
  unusedSubscriptions: UnusedSubscription[];
  currency: string;
}

export function UnusedSubscriptions() {
  const [data, setData] = useState<UnusedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnusedSubscriptions();
  }, []);

  const fetchUnusedSubscriptions = async () => {
    try {
      const response = await fetch('/api/dashboard/enhanced-stats');
      if (response.ok) {
        const stats = await response.json();
        setData({
          unusedSubscriptions: stats.unusedSubscriptions || [],
          currency: stats.currency
        });
      }
    } catch (error) {
      console.error('Failed to fetch unused subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
            Subscription Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.unusedSubscriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-green-500" />
            Subscription Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Great! All your subscriptions have been used recently.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalWasted = data.unusedSubscriptions.reduce((sum, sub) => {
    return sum + getMonthlyAmount(sub.cost, sub.billing_cycle as any);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
          Subscription Audit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
            {data.unusedSubscriptions.length} subscription{data.unusedSubscriptions.length > 1 ? 's' : ''} unused for 30+ days
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
            Potentially wasting {formatCurrency(totalWasted, data.currency)}/month
          </p>
        </div>

        <div className="space-y-3">
          {data.unusedSubscriptions.slice(0, 3).map((sub) => (
            <div key={sub.subscription_id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{sub.service_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {sub.last_used_at ? `Last used ${sub.days_unused} days ago` : 'Never used'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {formatCurrency(getMonthlyAmount(sub.cost, sub.billing_cycle as any), data.currency)}/mo
                </Badge>
                <Link href={`/subscriptions/${sub.subscription_id}/edit`}>
                  <Button size="sm" variant="outline">Review</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {data.unusedSubscriptions.length > 3 && (
          <Link href="/subscriptions?filter=unused" className="block mt-4">
            <Button variant="outline" className="w-full">
              View all {data.unusedSubscriptions.length} unused subscriptions
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}