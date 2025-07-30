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

    const body = await request.json();
    const { userEmailId, email } = body;

    if (!userEmailId || !email) {
      return NextResponse.json({ error: 'User email ID and email are required' }, { status: 400 });
    }

    // Verify the user email belongs to the authenticated user
    const { data: userEmail, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('id', userEmailId)
      .eq('user_id', session.user.id)
      .single();

    if (emailError || !userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    const webhookUrl = process.env.CLOUDFLARE_WEBHOOK_URL || 'https://subtracker.app/api/webhooks/cloudflare';

    // Create Cloudflare email route
    const route = await cloudflare.createEmailAddress(email, webhookUrl);

    // Update user email with Cloudflare route ID
    await supabase
      .from('user_emails')
      .update({
        cloudflare_route_id: route.id,
        is_active: true,
      })
      .eq('id', userEmailId);

    return NextResponse.json({
      success: true,
      route,
      message: 'Email address configured successfully',
    });
  } catch (error) {
    console.error('Error creating Cloudflare email address:', error);
    return NextResponse.json({ error: 'Failed to create email address' }, { status: 500 });
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
    const userEmailId = searchParams.get('userEmailId');
    const email = searchParams.get('email');

    if (!userEmailId || !email) {
      return NextResponse.json({ error: 'User email ID and email are required' }, { status: 400 });
    }

    // Verify the user email belongs to the authenticated user
    const { data: userEmail, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('id', userEmailId)
      .eq('user_id', session.user.id)
      .single();

    if (emailError || !userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    // Delete Cloudflare email route
    await cloudflare.deleteEmailAddress(email);

    // Update user email to remove Cloudflare route ID
    await supabase
      .from('user_emails')
      .update({
        cloudflare_route_id: null,
        is_active: false,
      })
      .eq('id', userEmailId);

    return NextResponse.json({
      success: true,
      message: 'Email address removed successfully',
    });
  } catch (error) {
    console.error('Error deleting Cloudflare email address:', error);
    return NextResponse.json({ error: 'Failed to delete email address' }, { status: 500 });
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
    const { userEmailId, enabled } = body;

    if (!userEmailId || enabled === undefined) {
      return NextResponse.json({ error: 'User email ID and enabled status are required' }, { status: 400 });
    }

    // Verify the user email belongs to the authenticated user
    const { data: userEmail, error: emailError } = await supabase
      .from('user_emails')
      .select('*')
      .eq('id', userEmailId)
      .eq('user_id', session.user.id)
      .single();

    if (emailError || !userEmail || !userEmail.cloudflare_route_id) {
      return NextResponse.json({ error: 'User email or Cloudflare route not found' }, { status: 404 });
    }

    const cloudflare = createCloudflareEmailAPI();
    if (!cloudflare) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    // Update Cloudflare route
    const route = await cloudflare.updateEmailRoute(userEmail.cloudflare_route_id, { enabled });

    // Update user email status
    await supabase
      .from('user_emails')
      .update({ is_active: enabled })
      .eq('id', userEmailId);

    return NextResponse.json({
      success: true,
      route,
      message: `Email address ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    console.error('Error updating Cloudflare email address:', error);
    return NextResponse.json({ error: 'Failed to update email address' }, { status: 500 });
  }
}