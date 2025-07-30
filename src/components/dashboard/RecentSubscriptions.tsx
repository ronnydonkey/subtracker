'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface Subscription {
  id: string;
  service_name: string;
  cost: number;
  currency: string;
  status: string;
  next_billing_date: string;
  category: {
    name: string;
    color: string;
  };
}

export function RecentSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentSubscriptions();
  }, []);

  const fetchRecentSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions?limit=5&sort=created_at');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Subscriptions</CardTitle>
          <Link
            href="/subscriptions"
            className="text-sm text-primary hover:text-primary/80"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No subscriptions yet
            </p>
            <Link
              href="/subscriptions/add"
              className="text-primary hover:text-primary/80 text-sm mt-2 inline-block"
            >
              Add your first subscription
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex-1">
                  <Link
                    href={`/subscriptions/${subscription.id}/edit`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary"
                  >
                    {subscription.service_name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(subscription.cost, subscription.currency)}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Next: {formatDate(subscription.next_billing_date)}
                    </span>
                  </div>
                </div>
                <Badge variant={getStatusColor(subscription.status) as any}>
                  {subscription.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}