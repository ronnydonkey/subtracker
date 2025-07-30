import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate, getStatusColor, getDaysUntil } from '@/lib/utils';
import {
  PencilIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface SubscriptionCardProps {
  subscription: {
    id: string;
    service_name: string;
    cost: number;
    currency: string;
    billing_cycle: string;
    status: string;
    next_billing_date: string;
    trial_end_date?: string;
    website_url?: string;
    cancellation_url?: string;
    category?: {
      name: string;
      color: string;
    };
  };
  onDelete: (id: string) => void;
}

export function SubscriptionCard({ subscription, onDelete }: SubscriptionCardProps) {
  const daysUntilBilling = getDaysUntil(subscription.next_billing_date);
  const isTrialEndingSoon = subscription.trial_end_date && 
    getDaysUntil(subscription.trial_end_date) <= 7;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {subscription.service_name}
              </h3>
              <Badge variant={getStatusColor(subscription.status) as any}>
                {subscription.status}
              </Badge>
              {subscription.category && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: subscription.category.color }}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {subscription.category.name}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(subscription.cost, subscription.currency)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  per {subscription.billing_cycle.replace('ly', '')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  Next billing: {formatDate(subscription.next_billing_date)}
                  {daysUntilBilling <= 7 && (
                    <Badge variant="warning" className="ml-2">
                      {daysUntilBilling === 0 ? 'Today' :
                       daysUntilBilling === 1 ? 'Tomorrow' :
                       `${daysUntilBilling} days`}
                    </Badge>
                  )}
                </div>
              </div>

              {isTrialEndingSoon && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
                  <ClockIcon className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800 dark:text-orange-200">
                    Trial ends {formatDate(subscription.trial_end_date!)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {subscription.website_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(subscription.website_url, '_blank')}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </Button>
            )}
            
            <Link href={`/subscriptions/${subscription.id}/edit`}>
              <Button
                variant="ghost"
                size="sm"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(subscription.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {subscription.cancellation_url && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => window.open(subscription.cancellation_url, '_blank')}
            >
              Cancel Subscription
              <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}