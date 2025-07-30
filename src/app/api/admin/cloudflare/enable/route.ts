import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createCloudflareEmailAPI } from '@/lib/cloudflare-email';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.email?.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const cloudflare = createCloudflareEmailAPI();
    
    if (!cloudflare) {
      return NextResponse.json({ 
        error: 'Cloudflare not configured',
        details: 'Missing required environment variables'
      }, { status: 500 });
    }

    try {
      // Enable email routing on the zone
      await cloudflare.enableEmailRouting();

      // Update database configuration
      await supabase
        .from('email_routing_config')
        .upsert({
          domain: process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech',
          cloudflare_zone_id: process.env.CLOUDFLARE_ZONE_ID!,
          is_active: true,
          email_routing_enabled: true,
          webhook_url: process.env.CLOUDFLARE_WEBHOOK_URL,
          last_verified_at: new Date().toISOString(),
        }, {
          onConflict: 'domain'
        });

      return NextResponse.json({
        success: true,
        message: 'Email routing enabled successfully',
        enabledAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to enable email routing:', error);
      return NextResponse.json({ 
        error: 'Failed to enable email routing',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Enable email routing error:', error);
    return NextResponse.json({ 
      error: 'Failed to enable email routing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}