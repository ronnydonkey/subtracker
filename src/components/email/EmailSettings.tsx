'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Cog6ToothIcon,
  EnvelopeIcon,
  BellIcon,
  EyeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface UserPreferences {
  email_forwarding: boolean;
  auto_detection: boolean;
  forward_to_email: string;
  notification_days_before: number;
}

interface EmailStats {
  total_emails: number;
  processed_emails: number;
  error_emails: number;
  spam_emails: number;
  total_detections: number;
  approved_detections: number;
  pending_detections: number;
}

export function EmailSettings() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prefsResponse, statsResponse] = await Promise.all([
        fetch('/api/users/preferences'),
        fetch('/api/email/stats'),
      ]);

      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setPreferences(prefsData);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedPrefs = await response.json();
        setPreferences(updatedPrefs);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update preferences');
      }
    } catch (err) {
      setError('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5" />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Email Forwarding */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Email Forwarding
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Forward emails to your primary address
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.email_forwarding || false}
                  onChange={(e) => updatePreferences({ email_forwarding: e.target.checked })}
                  className="sr-only peer"
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {preferences?.email_forwarding && (
              <Input
                type="email"
                placeholder="your-email@example.com"
                value={preferences?.forward_to_email || ''}
                onChange={(e) => updatePreferences({ forward_to_email: e.target.value })}
                disabled={saving}
              />
            )}
          </div>

          {/* Auto Detection */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Auto Detection
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically detect subscription patterns
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences?.auto_detection || false}
                onChange={(e) => updatePreferences({ auto_detection: e.target.checked })}
                className="sr-only peer"
                disabled={saving}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Notification Settings */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Notification Timing
            </h4>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="30"
                value={preferences?.notification_days_before || 7}
                onChange={(e) => updatePreferences({ 
                  notification_days_before: parseInt(e.target.value) || 7 
                })}
                className="w-20"
                disabled={saving}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                days before renewal
              </span>
            </div>
          </div>

          <Button
            onClick={() => updatePreferences({})}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5" />
              Email Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_emails}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Emails
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.processed_emails}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Processed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_detections}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Detections
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.pending_detections}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Pending
                </div>
              </div>
            </div>

            {stats.error_emails > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="text-sm text-red-800 dark:text-red-200">
                  {stats.error_emails} emails had processing errors
                </div>
              </div>
            )}

            {stats.spam_emails > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  {stats.spam_emails} emails were marked as spam
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="h-5 w-5" />
            Email Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <Badge variant="info" className="mt-0.5">1</Badge>
              <span>Emails are received and logged automatically</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="info" className="mt-0.5">2</Badge>
              <span>Our AI scans for subscription patterns</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="info" className="mt-0.5">3</Badge>
              <span>High-confidence detections are auto-added</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="info" className="mt-0.5">4</Badge>
              <span>You can review and approve pending detections</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}