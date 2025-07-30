'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { formatCurrency } from '@/lib/utils';
import { 
  ExclamationTriangleIcon,
  CogIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface BudgetStatus {
  limit: number;
  used: number;
  percentage: number;
  exceeded: boolean;
  alert_threshold: number;
  currency: string;
}

export function BudgetAlert() {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgetStatus();
  }, []);

  const fetchBudgetStatus = async () => {
    try {
      const response = await fetch('/api/dashboard/enhanced-stats');
      if (response.ok) {
        const data = await response.json();
        setBudgetStatus(data.budgetStatus);
      }
    } catch (error) {
      console.error('Failed to fetch budget status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-6 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if no budget is set
  if (!budgetStatus) {
    return null;
  }

  const getStatusColor = () => {
    if (budgetStatus.exceeded) return 'text-red-600 dark:text-red-400';
    if (budgetStatus.percentage >= budgetStatus.alert_threshold) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = () => {
    if (budgetStatus.exceeded) return 'bg-red-500';
    if (budgetStatus.percentage >= budgetStatus.alert_threshold) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getIcon = () => {
    if (budgetStatus.exceeded || budgetStatus.percentage >= budgetStatus.alert_threshold) {
      return ExclamationTriangleIcon;
    }
    return CheckCircleIcon;
  };

  const Icon = getIcon();

  return (
    <Card className={`border-l-4 ${
      budgetStatus.exceeded 
        ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20' 
        : budgetStatus.percentage >= budgetStatus.alert_threshold
          ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
          : 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 ${getStatusColor()}`}>
          <Icon className="h-5 w-5" />
          Monthly Budget Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(budgetStatus.used, budgetStatus.currency)} of{' '}
            {formatCurrency(budgetStatus.limit, budgetStatus.currency)}
          </span>
          <span className={`font-semibold ${getStatusColor()}`}>
            {budgetStatus.percentage}%
          </span>
        </div>

        <Progress 
          value={Math.min(budgetStatus.percentage, 100)} 
          className="h-3"
          indicatorClassName={getProgressColor()}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm">
            {budgetStatus.exceeded ? (
              <span className="text-red-700 dark:text-red-300 font-medium">
                Over budget by {formatCurrency(budgetStatus.used - budgetStatus.limit, budgetStatus.currency)}
              </span>
            ) : budgetStatus.percentage >= budgetStatus.alert_threshold ? (
              <span className="text-orange-700 dark:text-orange-300 font-medium">
                Approaching budget limit
              </span>
            ) : (
              <span className="text-green-700 dark:text-green-300 font-medium">
                Within budget
              </span>
            )}
          </div>
          
          <Link href="/settings/notifications">
            <Button size="sm" variant="outline">
              <CogIcon className="h-4 w-4 mr-1" />
              Adjust
            </Button>
          </Link>
        </div>

        {budgetStatus.exceeded && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded">
            💡 Consider reviewing your subscriptions or increasing your budget limit
          </div>
        )}
      </CardContent>
    </Card>
  );
}