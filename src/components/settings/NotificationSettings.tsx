'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { 
  BellIcon, 
  EnvelopeIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface UserPreferences {
  monthly_budget_limit: number | null;
  budget_alert_enabled: boolean;
  budget_alert_threshold: number;
  trial_ending_days_notice: number;
  payment_upcoming_days_notice: number;
  cancellation_reminder_days: number;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  weekly_summary_enabled: boolean;
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    monthly_budget_limit: null,
    budget_alert_enabled: true,
    budget_alert_threshold: 80,
    trial_ending_days_notice: 3,
    payment_upcoming_days_notice: 2,
    cancellation_reminder_days: 30,
    email_notifications_enabled: true,
    push_notifications_enabled: false,
    weekly_summary_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/users/preferences');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setPreferences(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaved(false);
    
    try {
      const response = await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5" />
            Budget Alerts
          </CardTitle>
          <CardDescription>
            Get notified when your subscription spending exceeds your budget
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="budget-alerts" className="text-sm font-medium">
              Enable budget alerts
            </label>
            <Switch
              id="budget-alerts"
              checked={preferences.budget_alert_enabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, budget_alert_enabled: checked })
              }
            />
          </div>

          {preferences.budget_alert_enabled && (
            <>
              <div>
                <label htmlFor="budget-limit" className="block text-sm font-medium mb-2">
                  Monthly budget limit ($)
                </label>
                <Input
                  id="budget-limit"
                  type="number"
                  placeholder="e.g., 200"
                  value={preferences.monthly_budget_limit || ''}
                  onChange={(e) => 
                    setPreferences({ 
                      ...preferences, 
                      monthly_budget_limit: e.target.value ? parseFloat(e.target.value) : null 
                    })
                  }
                />
              </div>

              <div>
                <label htmlFor="alert-threshold" className="block text-sm font-medium mb-2">
                  Alert when spending reaches (%)
                </label>
                <Input
                  id="alert-threshold"
                  type="number"
                  min="1"
                  max="100"
                  value={preferences.budget_alert_threshold}
                  onChange={(e) => 
                    setPreferences({ 
                      ...preferences, 
                      budget_alert_threshold: parseInt(e.target.value) || 80 
                    })
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trial & Payment Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Trial & Payment Alerts
          </CardTitle>
          <CardDescription>
            Control when you receive alerts about trials ending and upcoming payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="trial-notice" className="block text-sm font-medium mb-2">
              Alert me before trials end (days)
            </label>
            <Input
              id="trial-notice"
              type="number"
              min="1"
              max="30"
              value={preferences.trial_ending_days_notice}
              onChange={(e) => 
                setPreferences({ 
                  ...preferences, 
                  trial_ending_days_notice: parseInt(e.target.value) || 3 
                })
              }
            />
          </div>

          <div>
            <label htmlFor="payment-notice" className="block text-sm font-medium mb-2">
              Alert me before payments (days)
            </label>
            <Input
              id="payment-notice"
              type="number"
              min="1"
              max="30"
              value={preferences.payment_upcoming_days_notice}
              onChange={(e) => 
                setPreferences({ 
                  ...preferences, 
                  payment_upcoming_days_notice: parseInt(e.target.value) || 2 
                })
              }
            />
          </div>

          <div>
            <label htmlFor="unused-notice" className="block text-sm font-medium mb-2">
              Alert me about unused subscriptions after (days)
            </label>
            <Input
              id="unused-notice"
              type="number"
              min="7"
              max="90"
              value={preferences.cancellation_reminder_days}
              onChange={(e) => 
                setPreferences({ 
                  ...preferences, 
                  cancellation_reminder_days: parseInt(e.target.value) || 30 
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellIcon className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="email-notifications" className="text-sm font-medium">
                Email notifications
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Receive alerts and summaries via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.email_notifications_enabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, email_notifications_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="push-notifications" className="text-sm font-medium">
                Push notifications
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Browser notifications for urgent alerts
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.push_notifications_enabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, push_notifications_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="weekly-summary" className="text-sm font-medium">
                Weekly summary emails
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Get a weekly overview of your subscriptions
              </p>
            </div>
            <Switch
              id="weekly-summary"
              checked={preferences.weekly_summary_enabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, weekly_summary_enabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {saved && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="text-sm">Saved successfully!</span>
          </div>
        )}
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}