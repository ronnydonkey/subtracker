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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    const routes = await cloudflare.getEmailRoutes();
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Error fetching email routes:', error);
    return NextResponse.json({ error: 'Failed to fetch email routes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, type } = body;

    if (!email || !type) {
      return NextResponse.json({ error: 'Email and type are required' }, { status: 400 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    const webhookUrl = process.env.CLOUDFLARE_WEBHOOK_URL || 'https://subtracker.app/api/webhooks/cloudflare';

    let route;
    
    if (type === 'specific') {
      // Create route for specific email address
      route = await cloudflare.createEmailAddress(email, webhookUrl);
    } else if (type === 'catch-all') {
      // Create catch-all route
      route = await cloudflare.createCatchAllRoute(webhookUrl);
    } else {
      return NextResponse.json({ error: 'Invalid route type' }, { status: 400 });
    }

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error('Error creating email route:', error);
    return NextResponse.json({ error: 'Failed to create email route' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { routeId, enabled, name } = body;

    if (!routeId) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    const updateData: any = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (name !== undefined) updateData.name = name;

    const route = await cloudflare.updateEmailRoute(routeId, updateData);
    return NextResponse.json(route);
  } catch (error) {
    console.error('Error updating email route:', error);
    return NextResponse.json({ error: 'Failed to update email route' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('id');

    if (!routeId) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    await cloudflare.deleteEmailRoute(routeId);
    return NextResponse.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting email route:', error);
    return NextResponse.json({ error: 'Failed to delete email route' }, { status: 500 });
  }
}