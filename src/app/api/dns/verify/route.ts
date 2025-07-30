import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { DNSSetupManager } from '@/lib/dns-setup';

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
    
    // Verify DNS setup
    const verification = await dnsManager.verifyDNSSetup();
    
    // Also check external propagation
    const propagation = await dnsManager.verifyDNSPropagation(domain);

    return NextResponse.json({
      ...verification,
      propagation,
      domain,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('DNS verification error:', error);
    return NextResponse.json({ error: 'DNS verification failed' }, { status: 500 });
  }
}