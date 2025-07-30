import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SubscriptionList } from '@/components/subscriptions/SubscriptionList';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function SubscriptionsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Subscriptions
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage all your subscriptions in one place
          </p>
        </div>
        <Link href="/subscriptions/add">
          <Button>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Subscription
          </Button>
        </Link>
      </div>

      <SubscriptionList />
    </div>
  );
}