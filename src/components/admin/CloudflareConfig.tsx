'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface CloudflareStatus {
  configured: boolean;
  emailRoutingEnabled: boolean;
  webhookConfigured: boolean;
  routesCount: number;
  lastVerified?: string;
  errors: string[];
}

export function CloudflareConfig() {
  const [status, setStatus] = useState<CloudflareStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    checkCloudflareStatus();
    fetchRoutes();
  }, []);

  const checkCloudflareStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cloudflare/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check Cloudflare status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/cloudflare/routes');
      if (response.ok) {
        const data = await response.json();
        setRoutes(data);
      }
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    }
  };

  const enableEmailRouting = async () => {
    try {
      const response = await fetch('/api/admin/cloudflare/enable', {
        method: 'POST',
      });
      
      if (response.ok) {
        await checkCloudflareStatus();
      }
    } catch (error) {
      console.error('Failed to enable email routing:', error);
    }
  };

  const createCatchAllRoute = async () => {
    try {
      const response = await fetch('/api/cloudflare/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'catch-all',
          email: '*',
        }),
      });
      
      if (response.ok) {
        await fetchRoutes();
      }
    } catch (error) {
      console.error('Failed to create catch-all route:', error);
    }
  };

  const testWebhook = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: 'webhook',
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Webhook test ${result.success ? 'passed' : 'failed'}: ${result.message}`);
      }
    } catch (error) {
      console.error('Webhook test failed:', error);
      alert('Webhook test failed');
    } finally {
      setTestLoading(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    
    try {
      const response = await fetch(`/api/cloudflare/routes?id=${routeId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await fetchRoutes();
      }
    } catch (error) {
      console.error('Failed to delete route:', error);
    }
  };

  const toggleRoute = async (routeId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/cloudflare/routes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          enabled: !enabled,
        }),
      });
      
      if (response.ok) {
        await fetchRoutes();
      }
    } catch (error) {
      console.error('Failed to toggle route:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudIcon className="h-6 w-6" />
            Cloudflare Email Routing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {status.configured ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">API Configured</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {status.emailRoutingEnabled ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">Email Routing Enabled</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {status.webhookConfigured ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">Webhook Configured</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm">Routes: {status.routesCount}</span>
                </div>
              </div>

              {status.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Configuration Issues:
                      </p>
                      <ul className="text-sm text-red-700 dark:text-red-300 mt-1 list-disc list-inside">
                        {status.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkCloudflareStatus}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                
                {!status.emailRoutingEnabled && (
                  <Button
                    size="sm"
                    onClick={enableEmailRouting}
                  >
                    Enable Email Routing
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testWebhook}
                  disabled={testLoading}
                >
                  {testLoading ? 'Testing...' : 'Test Webhook'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CloudIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Unable to load Cloudflare status
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Routes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Routes</CardTitle>
            <Button
              size="sm"
              onClick={createCatchAllRoute}
              disabled={routes.some(r => r.pattern === '*')}
            >
              Create Catch-All Route
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <div className="text-center py-8">
              <CogIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No email routes configured
              </p>
              <Button onClick={createCatchAllRoute}>
                Create Catch-All Route
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {routes.map((route) => (
                <div
                  key={route.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {route.name}
                        </h4>
                        <Badge variant={route.enabled ? 'success' : 'secondary'}>
                          {route.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Pattern: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{route.pattern}</code></p>
                        <p>Actions: {route.actions?.length || 0} configured</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRoute(route.id, route.enabled)}
                      >
                        {route.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRoute(route.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  CLOUDFLARE_API_TOKEN:
                </span>
                <span className="ml-2">
                  {process.env.CLOUDFLARE_API_TOKEN ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  CLOUDFLARE_ZONE_ID:
                </span>
                <span className="ml-2">
                  {process.env.CLOUDFLARE_ZONE_ID ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  CLOUDFLARE_EMAIL_DOMAIN:
                </span>
                <span className="ml-2">
                  {process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  CLOUDFLARE_WEBHOOK_URL:
                </span>
                <span className="ml-2 text-xs">
                  {process.env.CLOUDFLARE_WEBHOOK_URL || 'Not set'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}