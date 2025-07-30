'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface EmailStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  bounced: number;
  spam: number;
}

interface EmailLog {
  id: string;
  sender_email: string;
  subject: string;
  received_at: string;
  status: string;
  delivery_status?: string;
  error_message?: string;
  subscription_detected?: boolean;
  confidence_score?: number;
}

interface MonitoringData {
  stats: EmailStats;
  recentEmails: EmailLog[];
  lastUpdated: string;
}

export function EmailMonitoring() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchMonitoringData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/monitoring/emails?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'bounced':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'spam':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      case 'pending':
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="success">Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'bounced':
        return <Badge variant="destructive">Bounced</Badge>;
      case 'spam':
        return <Badge variant="warning">Spam</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const deliveryRate = data?.stats && data.stats.total > 0 
    ? Math.round((data.stats.delivered / data.stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Monitoring
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track email delivery and processing performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <EnvelopeIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Emails
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data?.stats.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Delivered
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data?.stats.delivered || 0}
                </p>
                <p className="text-xs text-green-600">
                  {deliveryRate}% success rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircleIcon className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Failed
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data?.stats.failed || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-gray-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Pending
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data?.stats.pending || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Recent Email Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          ) : data?.recentEmails.length === 0 ? (
            <div className="text-center py-8">
              <EnvelopeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No recent email activity
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.recentEmails.map((email) => (
                <div
                  key={email.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(email.delivery_status || email.status)}
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {email.subject}
                        </h4>
                        {getStatusBadge(email.delivery_status || email.status)}
                        {email.subscription_detected && (
                          <Badge variant="outline">Subscription Detected</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>From: <span className="font-mono">{email.sender_email}</span></p>
                        <p>Received: {new Date(email.received_at).toLocaleString()}</p>
                        {email.confidence_score && (
                          <p>Confidence: {Math.round(email.confidence_score * 100)}%</p>
                        )}
                        {email.error_message && (
                          <p className="text-red-600 dark:text-red-400">
                            Error: {email.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data?.lastUpdated && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}