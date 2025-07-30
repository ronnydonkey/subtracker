import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { DNSSetupManager } from '@/lib/dns-setup';
import { createCloudflareEmailAPI } from '@/lib/cloudflare-email';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const dnsManager = new DNSSetupManager(domain);
    const cloudflare = createCloudflareEmailAPI();

    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    // Setup DNS records
    const dnsResult = await dnsManager.setupDNSRecords();
    
    // Enable email routing if DNS setup was successful
    let emailRoutingEnabled = false;
    if (dnsResult.success) {
      try {
        await cloudflare.enableEmailRouting();
        emailRoutingEnabled = true;
      } catch (error) {
        console.error('Failed to enable email routing:', error);
        dnsResult.errors.push('Failed to enable email routing');
      }
    }

    return NextResponse.json({
      ...dnsResult,
      emailRoutingEnabled,
      domain,
      setupAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('DNS setup error:', error);
    return NextResponse.json({ error: 'DNS setup failed' }, { status: 500 });
  }
}