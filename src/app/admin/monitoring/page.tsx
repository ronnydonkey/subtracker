import { CloudflareConfig } from '@/components/admin/CloudflareConfig';
import { EmailMonitoring } from '@/components/monitoring/EmailMonitoring';

export default function MonitoringPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          System Monitoring
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Monitor email processing, delivery status, and system health
        </p>
      </div>

      {/* Email Monitoring */}
      <EmailMonitoring />

      {/* Cloudflare Configuration */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Cloudflare Configuration
        </h2>
        <CloudflareConfig />
      </div>
    </div>
  );
}