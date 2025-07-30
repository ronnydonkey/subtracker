'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface DetectedSubscription {
  id: string;
  service_name: string;
  detection_type: string;
  confidence_score: number;
  cost?: number;
  currency?: string;
  billing_cycle?: string;
  trial_end_date?: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_added';
  created_at: string;
  email_log: {
    sender_email: string;
    subject: string;
    received_at: string;
  };
}

export function DetectedSubscriptions() {
  const [detections, setDetections] = useState<DetectedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');

  useEffect(() => {
    fetchDetections();
  }, [filter]);

  const fetchDetections = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }
      
      const response = await fetch(`/api/email/detections?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDetections(data);
      }
    } catch (error) {
      console.error('Failed to fetch detections:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDetectionStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    
    try {
      const response = await fetch('/api/email/detections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status }),
      });

      if (response.ok) {
        // Remove from list if filtering by pending
        if (filter === 'pending') {
          setDetections(detections.filter(d => d.id !== id));
        } else {
          // Update status in list
          setDetections(detections.map(d => 
            d.id === id ? { ...d, status } : d
          ));
        }
      }
    } catch (error) {
      console.error('Failed to update detection:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getDetectionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      trial_signup: 'Trial Signup',
      trial_reminder: 'Trial Reminder',
      billing_confirmation: 'Billing Confirmation',
      subscription_start: 'Subscription Start',
      price_change: 'Price Change',
    };
    return labels[type] || type;
  };

  const getDetectionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      trial_signup: 'info',
      trial_reminder: 'warning',
      billing_confirmation: 'success',
      subscription_start: 'success',
      price_change: 'warning',
    };
    return colors[type] || 'default';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Detected Subscriptions
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={filter === 'approved' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approved
            </Button>
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Review and manage automatically detected subscriptions from your emails
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            ))}
          </div>
        ) : detections.length === 0 ? (
          <div className="text-center py-12">
            <SparklesIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filter === 'pending' ? 'No pending detections' : 'No detections found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'pending' 
                ? 'We\'ll notify you when new subscription patterns are detected in your emails.'
                : 'Start using your SubTracker email addresses to automatically detect subscriptions.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {detections.map((detection) => (
              <div
                key={detection.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {detection.service_name}
                      </h4>
                      <Badge variant={getDetectionTypeColor(detection.detection_type) as any}>
                        {getDetectionTypeLabel(detection.detection_type)}
                      </Badge>
                      <Badge variant={getConfidenceColor(detection.confidence_score) as any}>
                        {Math.round(detection.confidence_score * 100)}% confidence
                      </Badge>
                      {detection.status !== 'pending' && (
                        <Badge variant={
                          detection.status === 'approved' ? 'success' : 
                          detection.status === 'auto_added' ? 'info' : 'secondary'
                        }>
                          {detection.status === 'auto_added' ? 'Auto Added' : detection.status}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span>From: {detection.email_log.sender_email}</span>
                        <span>
                          Detected: {formatDate(detection.created_at)}
                        </span>
                      </div>
                      
                      {(detection.cost || detection.billing_cycle) && (
                        <div className="flex items-center gap-4">
                          {detection.cost && (
                            <span>
                              Cost: {formatCurrency(detection.cost, detection.currency)}
                            </span>
                          )}
                          {detection.billing_cycle && (
                            <span>Billing: {detection.billing_cycle}</span>
                          )}
                        </div>
                      )}

                      {detection.trial_end_date && (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          <span>Trial ends: {formatDate(detection.trial_end_date)}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Subject: "{detection.email_log.subject}"
                      </div>
                    </div>
                  </div>

                  {detection.status === 'pending' && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateDetectionStatus(detection.id, 'approved')}
                        disabled={processing === detection.id}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateDetectionStatus(detection.id, 'rejected')}
                        disabled={processing === detection.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}