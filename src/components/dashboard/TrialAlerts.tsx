'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, getDaysUntil, formatCurrency, getMonthlyAmount } from '@/lib/utils';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface TrialAlert {
  id: string;
  service_name: string;
  trial_end_date: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  cancellation_url?: string;
  daysRemaining: number;
}

export function TrialAlerts() {
  const [trials, setTrials] = useState<TrialAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrialAlerts();
  }, []);

  const fetchTrialAlerts = async () => {
    try {
      const response = await fetch('/api/subscriptions?status=trial&ending_soon=true');
      if (response.ok) {
        const data = await response.json();
        const trialsWithDays = data.map((trial: any) => ({
          ...trial,
          daysRemaining: getDaysUntil(trial.trial_end_date),
        }));
        setTrials(trialsWithDays);
      }
    } catch (error) {
      console.error('Failed to fetch trial alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertVariant = (daysRemaining: number) => {
    if (daysRemaining <= 1) return 'destructive';
    if (daysRemaining <= 3) return 'warning';
    return 'info';
  };

  const getAlertIcon = (daysRemaining: number) => {
    if (daysRemaining <= 1) return ExclamationTriangleIcon;
    return ClockIcon;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trial Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5" />
          Trial Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trials.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No trials ending soon
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trials.map((trial) => {
              const AlertIcon = getAlertIcon(trial.daysRemaining);
              const variant = getAlertVariant(trial.daysRemaining);
              
              return (
                <div
                  key={trial.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertIcon className={`h-5 w-5 mt-0.5 ${
                        variant === 'destructive' ? 'text-red-500' :
                        variant === 'warning' ? 'text-orange-500' :
                        'text-blue-500'
                      }`} />
                      <div>
                        <Link
                          href={`/subscriptions/${trial.id}/edit`}
                          className="font-medium text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary"
                        >
                          {trial.service_name}
                        </Link>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Trial ends {formatDate(trial.trial_end_date)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Then {formatCurrency(trial.cost, trial.currency)} {trial.billing_cycle}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          That's {formatCurrency(getMonthlyAmount(trial.cost, trial.billing_cycle as any), trial.currency)}/month
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={variant}>
                        {trial.daysRemaining === 0 ? 'Today' :
                         trial.daysRemaining === 1 ? 'Tomorrow' :
                         `${trial.daysRemaining} days`}
                      </Badge>
                      <div className="flex gap-2">
                        <Link href={`/subscriptions/${trial.id}/edit`}>
                          <Button size="sm" variant="outline">
                            Keep It
                          </Button>
                        </Link>
                        {trial.cancellation_url && (
                          <a 
                            href={trial.cancellation_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Button size="sm" variant="destructive">
                              Cancel
                              <ArrowTopRightOnSquareIcon className="h-3 w-3 ml-1" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}