import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function AddSubscriptionPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/subscriptions">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Subscriptions
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Add New Subscription
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Add a new subscription to track your spending
        </p>
      </div>

      <div className="max-w-2xl">
        <SubscriptionForm />
      </div>
    </div>
  );
}