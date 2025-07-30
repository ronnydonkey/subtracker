import { CloudflareConfig } from '@/components/admin/CloudflareConfig';
import { DNSInstructions } from '@/components/setup/DNSInstructions';

export default function EmailSetupPage() {
  const domain = process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Email System Setup
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure Cloudflare Email Routing for SubTracker
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <CloudflareConfig />
        </div>
        <div>
          <DNSInstructions 
            domain={domain} 
            autoSetup={true}
          />
        </div>
      </div>
    </div>
  );
}