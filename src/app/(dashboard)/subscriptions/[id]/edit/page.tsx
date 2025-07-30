import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface EditSubscriptionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditSubscriptionPage({ params }: EditSubscriptionPageProps) {
  const { id } = await params;
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
          Edit Subscription
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update your subscription details
        </p>
      </div>

      <div className="max-w-2xl">
        <SubscriptionForm subscriptionId={id} />
      </div>
    </div>
  );
}