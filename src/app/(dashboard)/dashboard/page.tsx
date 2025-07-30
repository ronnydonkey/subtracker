import { EnhancedStatsCards } from '@/components/dashboard/EnhancedStatsCards';
import { SubscriptionCards } from '@/components/dashboard/SubscriptionCards';
import { UpcomingPayments } from '@/components/dashboard/UpcomingPayments';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { TrialAlerts } from '@/components/dashboard/TrialAlerts';
import { UnusedSubscriptions } from '@/components/dashboard/UnusedSubscriptions';
import { CostInsights } from '@/components/dashboard/CostInsights';
import { BudgetAlert } from '@/components/dashboard/BudgetAlert';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';

export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage your subscriptions and track spending
          </p>
        </div>
        <Link href="/subscriptions/add">
          <Button size="lg">
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Subscription
          </Button>
        </Link>
      </div>

      <EnhancedStatsCards />

      <SubscriptionCards />

      <CostInsights />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <TrialAlerts />
          <UnusedSubscriptions />
        </div>
        <div className="space-y-8">
          <BudgetAlert />
          <UpcomingPayments />
          <QuickStats />
        </div>
      </div>
    </div>
  );
}