import { EmailSetup } from '@/components/email/EmailSetup';
import { EmailSettings } from '@/components/email/EmailSettings';
import { DetectedSubscriptions } from '@/components/email/DetectedSubscriptions';

export default function EmailPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Email Management
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your SubTracker email addresses and subscription detection
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <EmailSetup />
          <DetectedSubscriptions />
        </div>
        <div>
          <EmailSettings />
        </div>
      </div>
    </div>
  );
}