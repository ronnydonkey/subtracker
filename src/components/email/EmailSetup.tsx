'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

interface UserEmail {
  id: string;
  email_address: string;
  alias: string;
  is_active: boolean;
  total_received: number;
  last_email_at: string | null;
  created_at: string;
}

export function EmailSetup() {
  const [emails, setEmails] = useState<UserEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await fetch('/api/users/email-address');
      if (response.ok) {
        const data = await response.json();
        setEmails(data);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to fetch emails');
      }
    } catch (err) {
      setError('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  const createEmail = async () => {
    if (!newAlias.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/users/email-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias: newAlias.trim() }),
      });

      if (response.ok) {
        const newEmail = await response.json();
        setEmails([newEmail, ...emails]);
        setNewAlias('');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to create email');
      }
    } catch (err) {
      setError('Failed to create email');
    } finally {
      setCreating(false);
    }
  };

  const toggleEmailStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/users/email-address', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, is_active: !isActive }),
      });

      if (response.ok) {
        const updatedEmail = await response.json();
        setEmails(emails.map(email => 
          email.id === id ? updatedEmail : email
        ));
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update email');
      }
    } catch (err) {
      setError('Failed to update email');
    }
  };

  const deleteEmail = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email address?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/email-address?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEmails(emails.filter(email => email.id !== id));
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to delete email');
      }
    } catch (err) {
      setError('Failed to delete email');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      createEmail();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EnvelopeIcon className="h-5 w-5" />
          Email Addresses
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create unique email addresses to track your subscriptions. Use these emails when signing up for services.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new email */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter alias (e.g., 'netflix', 'spotify')"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={creating}
            />
          </div>
          <Button
            onClick={createEmail}
            disabled={creating || !newAlias.trim() || emails.length >= 5}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {emails.length >= 5 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-md text-sm">
            You've reached the maximum of 5 email addresses. Delete an existing one to create a new one.
          </div>
        )}

        {/* Email list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12">
            <EnvelopeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No email addresses yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first email address to start tracking subscriptions automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                        {email.email_address}
                      </code>
                      <Badge variant={email.is_active ? 'success' : 'secondary'}>
                        {email.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>Alias: {email.alias}</span>
                      <span>Received: {email.total_received} emails</span>
                      {email.last_email_at && (
                        <span>
                          Last: {new Date(email.last_email_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(email.email_address, email.id)}
                    >
                      {copiedId === email.id ? (
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEmailStatus(email.id, email.is_active)}
                    >
                      {email.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEmail(email.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help text */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            How to use these email addresses:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use these emails when signing up for new services</li>
            <li>• Each email automatically detects subscription patterns</li>
            <li>• Emails are forwarded to your primary address (if enabled)</li>
            <li>• You'll get notifications when new subscriptions are detected</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}