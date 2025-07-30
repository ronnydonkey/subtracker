'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface Subscription {
  id: string;
  service_name: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  status: string;
  next_billing_date: string;
  category?: {
    name: string;
    color: string;
  };
}

export function SubscriptionCards() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions?limit=8&status=active');
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

  const getDaysUntilNextBilling = (date: string) => {
    const nextBilling = new Date(date);
    const today = new Date();
    const diffTime = nextBilling.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Subscriptions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Your Subscriptions</h2>
        <Link 
          href="/subscriptions" 
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          View all →
        </Link>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {subscriptions.map((subscription) => {
          const daysUntil = getDaysUntilNextBilling(subscription.next_billing_date);
          const isUrgent = daysUntil <= 3;
          
          return (
            <Link key={subscription.id} href={`/subscriptions/${subscription.id}/edit`}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{subscription.service_name}</h3>
                    {subscription.category && (
                      <Badge 
                        variant="secondary" 
                        className="mt-1"
                        style={{ 
                          backgroundColor: `${subscription.category.color}20`,
                          color: subscription.category.color 
                        }}
                      >
                        {subscription.category.name}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={subscription.status === 'active' ? 'success' : 'secondary'}>
                    {subscription.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {formatCurrency(subscription.cost, subscription.currency)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      per {subscription.billing_cycle.replace('-', ' ')}
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-1 text-sm ${
                    isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <CalendarIcon className="h-4 w-4" />
                    <span>Next payment: {daysUntil} days</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}