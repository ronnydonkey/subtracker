import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createCloudflareEmailAPI } from '@/lib/cloudflare-email';
import { EmailSubscriptionParser } from '@/lib/email-parser';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { testType } = body;

    switch (testType) {
      case 'webhook':
        return await testWebhook();
      
      case 'email-parsing':
        return await testEmailParsing(body.email);
      
      case 'cloudflare-api':
        return await testCloudflareAPI();
      
      case 'end-to-end':
        return await testEndToEnd();
      
      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testWebhook() {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/cloudflare`;
    
    // Test webhook endpoint with sample data
    const testData = {
      envelope: {
        to: 'test@subtracker.tech',
        from: 'test@example.com',
      },
      headers: {
        'subject': 'Test Email - Netflix Subscription',
        'date': new Date().toISOString(),
      },
      content: {
        text: 'Your Netflix subscription has been renewed for $15.99/month.',
        html: '<p>Your Netflix subscription has been renewed for $15.99/month.</p>',
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': 'cloudflare-test',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      message: response.ok 
        ? 'Webhook test successful'
        : `Webhook test failed: ${result.error || 'Unknown error'}`,
      details: result,
      webhookUrl,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Webhook test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testEmailParsing(emailContent?: string) {
  try {
    const testEmail = emailContent || `
Subject: Your Netflix subscription has been renewed

Hi there,

Your Netflix subscription has been renewed for $15.99/month.
Your next billing date is January 27, 2025.

Thank you for being a Netflix subscriber!

Best regards,
Netflix Team
    `.trim();

    const result = await EmailSubscriptionParser.parseEmail({
      from: 'netflix@example.com',
      to: 'user@subtracker.tech',
      subject: 'Your Netflix subscription has been renewed',
      bodyText: testEmail,
      receivedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Email parsing test completed',
      result,
      testEmail,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Email parsing test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testCloudflareAPI() {
  try {
    const cloudflare = createCloudflareEmailAPI();
    
    if (!cloudflare) {
      return NextResponse.json({
        success: false,
        message: 'Cloudflare API not configured',
        details: {
          apiToken: !!process.env.CLOUDFLARE_API_TOKEN,
          zoneId: !!process.env.CLOUDFLARE_ZONE_ID,
          domain: process.env.CLOUDFLARE_EMAIL_DOMAIN,
        },
      });
    }

    // Test API connectivity by fetching current routes
    const routes = await cloudflare.getEmailRoutes();
    
    // Test zone verification
    const zoneInfo = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const zoneData = await zoneInfo.json();

    return NextResponse.json({
      success: true,
      message: 'Cloudflare API test successful',
      details: {
        routesCount: routes.length,
        zoneStatus: zoneData.success ? 'active' : 'error',
        zoneName: zoneData.result?.name,
        apiConnectivity: true,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Cloudflare API test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        apiToken: !!process.env.CLOUDFLARE_API_TOKEN,
        zoneId: !!process.env.CLOUDFLARE_ZONE_ID,
        domain: process.env.CLOUDFLARE_EMAIL_DOMAIN,
      },
    });
  }
}

async function testEndToEnd() {
  try {
    const results = {
      cloudflareAPI: await testCloudflareAPI().then(r => r.json()),
      emailParsing: await testEmailParsing().then(r => r.json()),
      webhook: await testWebhook().then(r => r.json()),
    };

    const allSuccess = Object.values(results).every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess 
        ? 'All end-to-end tests passed'
        : 'Some end-to-end tests failed',
      results,
      summary: {
        passed: Object.values(results).filter(r => r.success).length,
        total: Object.keys(results).length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'End-to-end test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}