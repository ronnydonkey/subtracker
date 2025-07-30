import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createCloudflareEmailAPI } from '@/lib/cloudflare-email';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (this is a simplified check - in production you'd have proper admin roles)
    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.email?.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const status = await getCloudflareStatus();
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Cloudflare status check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check Cloudflare status',
      configured: false,
      emailRoutingEnabled: false,
      webhookConfigured: false,
      routesCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

async function getCloudflareStatus() {
  const errors: string[] = [];
  let configured = false;
  let emailRoutingEnabled = false;
  let webhookConfigured = false;
  let routesCount = 0;

  // Check environment variables
  const hasApiToken = !!process.env.CLOUDFLARE_API_TOKEN;
  const hasZoneId = !!process.env.CLOUDFLARE_ZONE_ID;
  const hasDomain = !!process.env.CLOUDFLARE_EMAIL_DOMAIN;
  const hasWebhookUrl = !!process.env.CLOUDFLARE_WEBHOOK_URL;

  if (!hasApiToken) errors.push('CLOUDFLARE_API_TOKEN not configured');
  if (!hasZoneId) errors.push('CLOUDFLARE_ZONE_ID not configured');
  if (!hasDomain) errors.push('CLOUDFLARE_EMAIL_DOMAIN not configured');
  if (!hasWebhookUrl) errors.push('CLOUDFLARE_WEBHOOK_URL not configured');

  configured = hasApiToken && hasZoneId && hasDomain;

  if (configured) {
    try {
      const cloudflare = createCloudflareEmailAPI();
      
      if (cloudflare) {
        // Check email routing status
        try {
          const routingStatus = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/email/routing`, {
            headers: {
              'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          });

          if (routingStatus.ok) {
            const routingData = await routingStatus.json();
            emailRoutingEnabled = routingData.result?.enabled || false;
          } else {
            errors.push('Failed to check email routing status');
          }
        } catch (error) {
          errors.push('Email routing API call failed');
        }

        // Check routes count
        try {
          const routes = await cloudflare.getEmailRoutes();
          routesCount = routes.length;
        } catch (error) {
          errors.push('Failed to fetch email routes');
        }

        // Check webhook configuration
        webhookConfigured = hasWebhookUrl && routesCount > 0;
      } else {
        errors.push('Failed to initialize Cloudflare API client');
      }
    } catch (error) {
      errors.push(`Cloudflare API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    configured,
    emailRoutingEnabled,
    webhookConfigured,
    routesCount,
    lastVerified: new Date().toISOString(),
    errors,
    environment: {
      apiToken: hasApiToken,
      zoneId: hasZoneId,
      domain: process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech',
      webhookUrl: hasWebhookUrl,
    },
  };
}