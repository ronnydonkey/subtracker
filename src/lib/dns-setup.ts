import { createCloudflareEmailAPI, type CloudflareDNSRecord } from './cloudflare-email';

export interface DNSVerificationResult {
  isValid: boolean;
  mxRecords: {
    found: CloudflareDNSRecord[];
    missing: string[];
    isValid: boolean;
  };
  spfRecord: {
    found: CloudflareDNSRecord | null;
    isValid: boolean;
    content?: string;
  };
  dmarcRecord: {
    found: CloudflareDNSRecord | null;
    isValid: boolean;
    content?: string;
  };
  emailRouting: {
    enabled: boolean;
    configured: boolean;
  };
}

export interface DNSSetupInstructions {
  domain: string;
  records: {
    type: 'MX' | 'TXT';
    name: string;
    content: string;
    priority?: number;
    description: string;
  }[];
  verification: {
    steps: string[];
    commands: string[];
  };
}

export class DNSSetupManager {
  private cloudflare = createCloudflareEmailAPI();
  private domain: string;

  constructor(domain?: string) {
    this.domain = domain || process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech';
  }

  // Required DNS records for Cloudflare Email Routing
  getRequiredDNSRecords(): DNSSetupInstructions {
    return {
      domain: this.domain,
      records: [
        {
          type: 'MX',
          name: this.domain,
          content: 'route1.mx.cloudflare.net',
          priority: 1,
          description: 'Primary mail exchange server for Cloudflare Email Routing',
        },
        {
          type: 'MX',
          name: this.domain,
          content: 'route2.mx.cloudflare.net',
          priority: 2,
          description: 'Secondary mail exchange server for redundancy',
        },
        {
          type: 'MX',
          name: this.domain,
          content: 'route3.mx.cloudflare.net',
          priority: 3,
          description: 'Tertiary mail exchange server for additional redundancy',
        },
        {
          type: 'TXT',
          name: this.domain,
          content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
          description: 'SPF record to authorize Cloudflare to send emails on your behalf',
        },
        {
          type: 'TXT',
          name: `_dmarc.${this.domain}`,
          content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@subtracker.app',
          description: 'DMARC policy for email authentication and reporting',
        },
      ],
      verification: {
        steps: [
          'Add all MX records with correct priorities',
          'Add SPF TXT record for email authorization',
          'Add DMARC TXT record for authentication policy',
          'Wait for DNS propagation (up to 24 hours)',
          'Verify setup using DNS lookup tools',
          'Enable Cloudflare Email Routing in dashboard',
        ],
        commands: [
          `dig MX ${this.domain}`,
          `dig TXT ${this.domain}`,
          `dig TXT _dmarc.${this.domain}`,
          'nslookup -type=MX subtracker.tech',
        ],
      },
    };
  }

  // Automatically setup DNS records
  async setupDNSRecords(): Promise<{
    success: boolean;
    created: CloudflareDNSRecord[];
    errors: string[];
  }> {
    if (!this.cloudflare) {
      return {
        success: false,
        created: [],
        errors: ['Cloudflare API not configured'],
      };
    }

    const created: CloudflareDNSRecord[] = [];
    const errors: string[] = [];

    try {
      // Get existing DNS records
      const existingRecords = await this.cloudflare.getDNSRecords();
      
      // Required records
      const requiredRecords = [
        {
          type: 'MX' as const,
          name: this.domain,
          content: 'route1.mx.cloudflare.net',
          priority: 1,
          ttl: 300,
        },
        {
          type: 'MX' as const,
          name: this.domain,
          content: 'route2.mx.cloudflare.net',
          priority: 2,
          ttl: 300,
        },
        {
          type: 'MX' as const,
          name: this.domain,
          content: 'route3.mx.cloudflare.net',
          priority: 3,
          ttl: 300,
        },
        {
          type: 'TXT' as const,
          name: this.domain,
          content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
          ttl: 300,
        },
        {
          type: 'TXT' as const,
          name: `_dmarc.${this.domain}`,
          content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@subtracker.app',
          ttl: 300,
        },
      ];

      for (const record of requiredRecords) {
        try {
          // Check if record already exists
          const existing = existingRecords.find(
            r => r.type === record.type && 
                 r.name === record.name && 
                 r.content === record.content
          );

          if (existing) {
            console.log(`DNS record already exists: ${record.type} ${record.name}`);
            continue;
          }

          // Create the record
          const createdRecord = await this.cloudflare.createDNSRecord(record);
          created.push(createdRecord);
          console.log(`Created DNS record: ${record.type} ${record.name}`);
        } catch (error) {
          const errorMessage = `Failed to create ${record.type} record: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      return {
        success: errors.length === 0,
        created,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        created,
        errors: [`DNS setup failed: ${error}`],
      };
    }
  }

  // Verify DNS configuration
  async verifyDNSSetup(): Promise<DNSVerificationResult> {
    if (!this.cloudflare) {
      return {
        isValid: false,
        mxRecords: { found: [], missing: [], isValid: false },
        spfRecord: { found: null, isValid: false },
        dmarcRecord: { found: null, isValid: false },
        emailRouting: { enabled: false, configured: false },
      };
    }

    try {
      const [dnsRecords, emailSettings] = await Promise.all([
        this.cloudflare.getDNSRecords(),
        this.cloudflare.getEmailRoutingSettings().catch(() => null),
      ]);

      // Check MX records
      const requiredMXRecords = [
        'route1.mx.cloudflare.net',
        'route2.mx.cloudflare.net',
        'route3.mx.cloudflare.net',
      ];

      const foundMXRecords = dnsRecords.filter(r => 
        r.type === 'MX' && 
        requiredMXRecords.includes(r.content)
      );

      const missingMXRecords = requiredMXRecords.filter(required =>
        !foundMXRecords.some(found => found.content === required)
      );

      // Check SPF record
      const spfRecord = dnsRecords.find(r => 
        r.type === 'TXT' && 
        r.name === this.domain &&
        r.content.includes('include:_spf.mx.cloudflare.net')
      );

      // Check DMARC record
      const dmarcRecord = dnsRecords.find(r => 
        r.type === 'TXT' && 
        r.name === `_dmarc.${this.domain}` &&
        r.content.startsWith('v=DMARC1')
      );

      const result: DNSVerificationResult = {
        isValid: false,
        mxRecords: {
          found: foundMXRecords,
          missing: missingMXRecords,
          isValid: foundMXRecords.length >= 3 && missingMXRecords.length === 0,
        },
        spfRecord: {
          found: spfRecord || null,
          isValid: !!spfRecord,
          content: spfRecord?.content,
        },
        dmarcRecord: {
          found: dmarcRecord || null,
          isValid: !!dmarcRecord,
          content: dmarcRecord?.content,
        },
        emailRouting: {
          enabled: emailSettings?.enabled || false,
          configured: !!emailSettings,
        },
      };

      result.isValid = 
        result.mxRecords.isValid && 
        result.spfRecord.isValid && 
        result.emailRouting.enabled;

      return result;
    } catch (error) {
      console.error('DNS verification failed:', error);
      return {
        isValid: false,
        mxRecords: { found: [], missing: [], isValid: false },
        spfRecord: { found: null, isValid: false },
        dmarcRecord: { found: null, isValid: false },
        emailRouting: { enabled: false, configured: false },
      };
    }
  }

  // External DNS verification using public DNS servers
  async verifyDNSPropagation(domain?: string): Promise<{
    propagated: boolean;
    mxRecords: any[];
    txtRecords: any[];
    errors: string[];
  }> {
    const targetDomain = domain || this.domain;
    const errors: string[] = [];

    try {
      // Use external DNS-over-HTTPS services for verification
      const dnsServers = [
        'https://cloudflare-dns.com/dns-query',
        'https://dns.google/dns-query',
      ];

      const mxRecords: any[] = [];
      const txtRecords: any[] = [];

      for (const server of dnsServers) {
        try {
          // Query MX records
          const mxResponse = await fetch(`${server}?name=${targetDomain}&type=MX`, {
            headers: { 'Accept': 'application/dns-json' },
          });
          
          if (mxResponse.ok) {
            const mxData = await mxResponse.json();
            if (mxData.Answer) {
              mxRecords.push(...mxData.Answer);
            }
          }

          // Query TXT records
          const txtResponse = await fetch(`${server}?name=${targetDomain}&type=TXT`, {
            headers: { 'Accept': 'application/dns-json' },
          });
          
          if (txtResponse.ok) {
            const txtData = await txtResponse.json();
            if (txtData.Answer) {
              txtRecords.push(...txtData.Answer);
            }
          }
        } catch (error) {
          errors.push(`DNS server ${server} failed: ${error}`);
        }
      }

      // Check if required records are present
      const hasCloudflareAMX = mxRecords.some(record => 
        record.data && record.data.includes('cloudflare.net')
      );

      const hasSPF = txtRecords.some(record => 
        record.data && record.data.includes('include:_spf.mx.cloudflare.net')
      );

      return {
        propagated: hasCloudflareAMX && hasSPF,
        mxRecords,
        txtRecords,
        errors,
      };
    } catch (error) {
      return {
        propagated: false,
        mxRecords: [],
        txtRecords: [],
        errors: [`External DNS verification failed: ${error}`],
      };
    }
  }

  // Clean up DNS records (for testing or removal)
  async cleanupDNSRecords(): Promise<{
    success: boolean;
    deleted: string[];
    errors: string[];
  }> {
    if (!this.cloudflare) {
      return {
        success: false,
        deleted: [],
        errors: ['Cloudflare API not configured'],
      };
    }

    const deleted: string[] = [];
    const errors: string[] = [];

    try {
      const dnsRecords = await this.cloudflare.getDNSRecords();
      
      // Find Cloudflare email-related records
      const emailRecords = dnsRecords.filter(record => 
        (record.type === 'MX' && record.content.includes('cloudflare.net')) ||
        (record.type === 'TXT' && record.content.includes('_spf.mx.cloudflare.net')) ||
        (record.type === 'TXT' && record.name.startsWith('_dmarc'))
      );

      for (const record of emailRecords) {
        try {
          if (record.id) {
            await this.cloudflare.deleteDNSRecord(record.id);
            deleted.push(`${record.type} ${record.name}`);
          }
        } catch (error) {
          errors.push(`Failed to delete ${record.type} ${record.name}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        deleted,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        deleted,
        errors: [`Cleanup failed: ${error}`],
      };
    }
  }

  // Generate setup instructions for manual configuration
  getManualSetupInstructions(): string[] {
    const instructions = this.getRequiredDNSRecords();
    
    return [
      `## DNS Setup Instructions for ${this.domain}`,
      '',
      '### Required DNS Records:',
      '',
      ...instructions.records.map(record => {
        if (record.type === 'MX') {
          return `**MX Record:**
- Name: ${record.name}
- Content: ${record.content}
- Priority: ${record.priority}
- TTL: 300 (or Auto)
- Description: ${record.description}`;
        } else {
          return `**TXT Record:**
- Name: ${record.name}
- Content: ${record.content}
- TTL: 300 (or Auto)
- Description: ${record.description}`;
        }
      }),
      '',
      '### Verification Steps:',
      ...instructions.verification.steps.map((step, index) => `${index + 1}. ${step}`),
      '',
      '### Verification Commands:',
      ...instructions.verification.commands.map(cmd => `\`${cmd}\``),
      '',
      '### Important Notes:',
      '- DNS changes can take up to 24 hours to propagate globally',
      '- Verify changes using multiple DNS lookup tools',
      '- Enable Cloudflare Email Routing after DNS setup is complete',
      '- Test email delivery before going live',
    ];
  }
}