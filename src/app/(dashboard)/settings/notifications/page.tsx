import { NotificationSettings } from '@/components/settings/NotificationSettings';

export default function NotificationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Notification Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure how and when you receive alerts about your subscriptions
        </p>
      </div>

      <NotificationSettings />
    </div>
  );
}