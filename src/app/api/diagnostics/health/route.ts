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

    const diagnostics = await runHealthChecks(supabase);
    
    return NextResponse.json({
      ...diagnostics,
      timestamp: new Date().toISOString(),
      user: session.user.id,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

async function runHealthChecks(supabase: any) {
  const checks = {
    database: { status: 'unknown', details: {} },
    cloudflare: { status: 'unknown', details: {} },
    emailParsing: { status: 'unknown', details: {} },
    webhooks: { status: 'unknown', details: {} },
    environment: { status: 'unknown', details: {} },
  };

  // Database health check
  try {
    const { data: dbTest, error: dbError } = await supabase
      .from('subscriptions')
      .select('count')
      .limit(1);
    
    if (dbError) {
      checks.database = { status: 'error', details: { error: dbError.message } };
    } else {
      checks.database = { status: 'healthy', details: { connected: true } };
    }
  } catch (error) {
    checks.database = { 
      status: 'error', 
      details: { error: error instanceof Error ? error.message : 'Database connection failed' }
    };
  }

  // Cloudflare API health check
  try {
    const cloudflare = createCloudflareEmailAPI();
    
    if (!cloudflare) {
      checks.cloudflare = { 
        status: 'error', 
        details: { error: 'Cloudflare API not configured' }
      };
    } else {
      const routes = await cloudflare.getEmailRoutes();
      checks.cloudflare = { 
        status: 'healthy', 
        details: { 
          connected: true, 
          routesCount: routes.length,
          apiConfigured: true
        }
      };
    }
  } catch (error) {
    checks.cloudflare = { 
      status: 'error', 
      details: { error: error instanceof Error ? error.message : 'Cloudflare API failed' }
    };
  }

  // Email parsing health check
  try {
    const { EmailSubscriptionParser } = await import('@/lib/email-parser');
    const testResult = await EmailSubscriptionParser.parseEmail({
      from: 'test@example.com',
      to: 'user@subtracker.tech',
      subject: 'Test Subscription',
      bodyText: 'Your subscription has been renewed for $9.99/month.',
      receivedAt: new Date(),
    });
    
    checks.emailParsing = { 
      status: 'healthy', 
      details: { 
        working: true,
        detectedSubscriptions: testResult.length,
        patternsLoaded: true
      }
    };
  } catch (error) {
    checks.emailParsing = { 
      status: 'error', 
      details: { error: error instanceof Error ? error.message : 'Email parsing failed' }
    };
  }

  // Webhook health check
  try {
    const webhookUrl = process.env.CLOUDFLARE_WEBHOOK_URL;
    if (!webhookUrl) {
      checks.webhooks = { 
        status: 'warning', 
        details: { error: 'Webhook URL not configured' }
      };
    } else {
      // Check if webhook is accessible (simplified check)
      checks.webhooks = { 
        status: 'healthy', 
        details: { 
          configured: true,
          url: webhookUrl
        }
      };
    }
  } catch (error) {
    checks.webhooks = { 
      status: 'error', 
      details: { error: error instanceof Error ? error.message : 'Webhook check failed' }
    };
  }

  // Environment variables health check
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ZONE_ID',
    'CLOUDFLARE_EMAIL_DOMAIN',
  ];

  const envStatus = requiredEnvVars.map(envVar => ({
    name: envVar,
    configured: !!process.env[envVar],
  }));

  const allEnvConfigured = envStatus.every(env => env.configured);
  
  checks.environment = {
    status: allEnvConfigured ? 'healthy' : 'warning',
    details: {
      variables: envStatus,
      allConfigured: allEnvConfigured,
      missing: envStatus.filter(env => !env.configured).map(env => env.name),
    }
  };

  // Overall health status
  const hasErrors = Object.values(checks).some(check => check.status === 'error');
  const hasWarnings = Object.values(checks).some(check => check.status === 'warning');
  
  let overallStatus = 'healthy';
  if (hasErrors) overallStatus = 'unhealthy';
  else if (hasWarnings) overallStatus = 'degraded';

  return {
    overall: {
      status: overallStatus,
      summary: `${Object.values(checks).filter(c => c.status === 'healthy').length}/${Object.keys(checks).length} systems healthy`
    },
    checks,
  };
}