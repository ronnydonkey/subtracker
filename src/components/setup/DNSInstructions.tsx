'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface DNSRecord {
  type: 'MX' | 'TXT';
  name: string;
  content: string;
  priority?: number;
  description: string;
}

interface DNSVerificationResult {
  isValid: boolean;
  mxRecords: {
    found: any[];
    missing: string[];
    isValid: boolean;
  };
  spfRecord: {
    found: any;
    isValid: boolean;
    content?: string;
  };
  dmarcRecord: {
    found: any;
    isValid: boolean;
    content?: string;
  };
  emailRouting: {
    enabled: boolean;
    configured: boolean;
  };
}

interface DNSInstructionsProps {
  domain: string;
  onSetupComplete?: () => void;
  autoSetup?: boolean;
}

export function DNSInstructions({ domain, onSetupComplete, autoSetup = false }: DNSInstructionsProps) {
  const [verification, setVerification] = useState<DNSVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoSetupLoading, setAutoSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);

  const requiredRecords: DNSRecord[] = [
    {
      type: 'MX',
      name: domain,
      content: 'route1.mx.cloudflare.net',
      priority: 1,
      description: 'Primary mail exchange server',
    },
    {
      type: 'MX',
      name: domain,
      content: 'route2.mx.cloudflare.net',
      priority: 2,
      description: 'Secondary mail exchange server',
    },
    {
      type: 'MX',
      name: domain,
      content: 'route3.mx.cloudflare.net',
      priority: 3,
      description: 'Tertiary mail exchange server',
    },
    {
      type: 'TXT',
      name: domain,
      content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
      description: 'SPF record for email authorization',
    },
    {
      type: 'TXT',
      name: `_dmarc.${domain}`,
      content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@subtracker.app',
      description: 'DMARC policy for email authentication',
    },
  ];

  useEffect(() => {
    verifyDNS();
  }, [domain]);

  const verifyDNS = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dns/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setVerification(result);
        
        if (result.isValid && onSetupComplete) {
          onSetupComplete();
        }
      }
    } catch (error) {
      console.error('DNS verification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSetupDNS = async () => {
    setAutoSetupLoading(true);
    try {
      const response = await fetch('/api/dns/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setSetupResult(result);
        
        // Verify after setup
        setTimeout(() => {
          verifyDNS();
        }, 2000);
      }
    } catch (error) {
      console.error('Auto setup failed:', error);
    } finally {
      setAutoSetupLoading(false);
    }
  };

  const copyToClipboard = async (text: string, recordId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecord(recordId);
      setTimeout(() => setCopiedRecord(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getRecordStatus = (record: DNSRecord) => {
    if (!verification) return 'unknown';
    
    if (record.type === 'MX') {
      const found = verification.mxRecords.found.some((found: any) => 
        found.content === record.content
      );
      return found ? 'valid' : 'missing';
    }
    
    if (record.type === 'TXT') {
      if (record.content.includes('spf1')) {
        return verification.spfRecord.isValid ? 'valid' : 'missing';
      }
      if (record.name.includes('_dmarc')) {
        return verification.dmarcRecord.isValid ? 'valid' : 'missing';
      }
    }
    
    return 'unknown';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'missing':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge variant="success">Configured</Badge>;
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {verification?.isValid ? (
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
            )}
            DNS Configuration for {domain}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {verification?.isValid ? (
                <p className="text-green-600 dark:text-green-400">
                  ✅ DNS is properly configured for email routing
                </p>
              ) : (
                <p className="text-orange-600 dark:text-orange-400">
                  ⚠️ DNS configuration needs attention
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={verifyDNS}
                disabled={loading}
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Checking...' : 'Verify'}
              </Button>
              {autoSetup && (
                <Button
                  onClick={autoSetupDNS}
                  disabled={autoSetupLoading || verification?.isValid}
                  size="sm"
                >
                  {autoSetupLoading ? 'Setting up...' : 'Auto Setup'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto Setup Result */}
      {setupResult && (
        <Card>
          <CardHeader>
            <CardTitle>Auto Setup Result</CardTitle>
          </CardHeader>
          <CardContent>
            {setupResult.success ? (
              <div className="text-green-600 dark:text-green-400">
                <p className="font-medium">✅ DNS records created successfully!</p>
                <p className="text-sm mt-1">
                  Created {setupResult.created.length} DNS records. 
                  It may take a few minutes for changes to propagate.
                </p>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                <p className="font-medium">❌ Auto setup encountered issues:</p>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {setupResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DNS Records */}
      <Card>
        <CardHeader>
          <CardTitle>Required DNS Records</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add these records to your DNS provider to enable email routing
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requiredRecords.map((record, index) => {
              const status = getRecordStatus(record);
              const recordId = `${record.type}-${index}`;
              
              return (
                <div
                  key={recordId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status)}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {record.type} Record
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {record.description}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Name:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {record.name}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.name, `${recordId}-name`)}
                        >
                          {copiedRecord === `${recordId}-name` ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Content:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded max-w-xs truncate">
                          {record.content}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.content, `${recordId}-content`)}
                        >
                          {copiedRecord === `${recordId}-content` ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {record.priority && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Priority:</span>
                        <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {record.priority}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Verification Commands */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Commands</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use these commands to verify your DNS configuration
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              `dig MX ${domain}`,
              `dig TXT ${domain}`,
              `dig TXT _dmarc.${domain}`,
              `nslookup -type=MX ${domain}`,
            ].map((command, index) => (
              <div key={index} className="flex items-center justify-between">
                <code className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded font-mono text-sm">
                  {command}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(command, `cmd-${index}`)}
                >
                  {copiedRecord === `cmd-${index}` ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  ) : (
                    <DocumentDuplicateIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <strong>DNS Propagation:</strong> Changes can take up to 24 hours to propagate globally.
              Use online DNS checker tools to verify propagation.
            </p>
            <p>
              <strong>Common Issues:</strong> Make sure to remove any existing MX records that conflict
              with Cloudflare's records. Only one set of MX records should be active.
            </p>
            <p>
              <strong>Testing:</strong> Send a test email to your domain after setup to verify
              email routing is working correctly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}