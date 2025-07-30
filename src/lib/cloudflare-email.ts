export interface CloudflareEmailRoute {
  id?: string;
  name: string;
  enabled: boolean;
  pattern: string;
  actions: CloudflareAction[];
  matchers: CloudflareMatcher[];
}

export interface CloudflareAction {
  type: 'forward' | 'drop' | 'worker';
  value: string[];
}

export interface CloudflareMatcher {
  type: 'literal' | 'all';
  field: 'to';
  value?: string;
}

export interface CloudflareEmailAddress {
  email: string;
  destination: string;
  verified: boolean;
  created: string;
  modified: string;
}

export interface CloudflareDNSRecord {
  id?: string;
  type: 'MX' | 'TXT';
  name: string;
  content: string;
  priority?: number;
  ttl?: number;
}

export class CloudflareEmailAPI {
  private apiToken: string;
  private zoneId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(apiToken: string, zoneId: string) {
    this.apiToken = apiToken;
    this.zoneId = zoneId;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`);
    }

    return data;
  }

  // Email Routing Routes Management
  async getEmailRoutes(): Promise<CloudflareEmailRoute[]> {
    const data = await this.makeRequest(`/zones/${this.zoneId}/email/routing/rules`);
    return data.result || [];
  }

  async createEmailRoute(route: Omit<CloudflareEmailRoute, 'id'>): Promise<CloudflareEmailRoute> {
    const data = await this.makeRequest(`/zones/${this.zoneId}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(route),
    });
    return data.result;
  }

  async updateEmailRoute(routeId: string, route: Partial<CloudflareEmailRoute>): Promise<CloudflareEmailRoute> {
    const data = await this.makeRequest(`/zones/${this.zoneId}/email/routing/rules/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(route),
    });
    return data.result;
  }

  async deleteEmailRoute(routeId: string): Promise<void> {
    await this.makeRequest(`/zones/${this.zoneId}/email/routing/rules/${routeId}`, {
      method: 'DELETE',
    });
  }

  // Email Routing Settings
  async getEmailRoutingSettings() {
    const data = await this.makeRequest(`/zones/${this.zoneId}/email/routing`);
    return data.result;
  }

  async enableEmailRouting(): Promise<void> {
    await this.makeRequest(`/zones/${this.zoneId}/email/routing`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
  }

  async disableEmailRouting(): Promise<void> {
    await this.makeRequest(`/zones/${this.zoneId}/email/routing`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
  }

  // DNS Records Management
  async getDNSRecords(type?: 'MX' | 'TXT'): Promise<CloudflareDNSRecord[]> {
    let endpoint = `/zones/${this.zoneId}/dns_records`;
    if (type) {
      endpoint += `?type=${type}`;
    }
    
    const data = await this.makeRequest(endpoint);
    return data.result || [];
  }

  async createDNSRecord(record: Omit<CloudflareDNSRecord, 'id'>): Promise<CloudflareDNSRecord> {
    const data = await this.makeRequest(`/zones/${this.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
    return data.result;
  }

  async updateDNSRecord(recordId: string, record: Partial<CloudflareDNSRecord>): Promise<CloudflareDNSRecord> {
    const data = await this.makeRequest(`/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
    return data.result;
  }

  async deleteDNSRecord(recordId: string): Promise<void> {
    await this.makeRequest(`/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // Email Address Management
  async createEmailAddress(email: string, webhookUrl: string): Promise<CloudflareEmailRoute> {
    const route: Omit<CloudflareEmailRoute, 'id'> = {
      name: `SubTracker Route for ${email}`,
      enabled: true,
      pattern: email,
      matchers: [
        {
          type: 'literal',
          field: 'to',
          value: email,
        },
      ],
      actions: [
        {
          type: 'worker',
          value: [webhookUrl],
        },
      ],
    };

    return this.createEmailRoute(route);
  }

  async deleteEmailAddress(email: string): Promise<void> {
    const routes = await this.getEmailRoutes();
    const route = routes.find(r => r.pattern === email);
    
    if (route && route.id) {
      await this.deleteEmailRoute(route.id);
    }
  }

  // Catch-all Route Management
  async createCatchAllRoute(webhookUrl: string): Promise<CloudflareEmailRoute> {
    const route: Omit<CloudflareEmailRoute, 'id'> = {
      name: 'SubTracker Catch-All Route',
      enabled: true,
      pattern: '*',
      matchers: [
        {
          type: 'all',
          field: 'to',
        },
      ],
      actions: [
        {
          type: 'worker',
          value: [webhookUrl],
        },
      ],
    };

    return this.createEmailRoute(route);
  }

  // DNS Setup for Email Routing
  async setupEmailDNS(domain: string): Promise<{ mx: CloudflareDNSRecord[], txt: CloudflareDNSRecord[] }> {
    const mxRecords = [
      {
        type: 'MX' as const,
        name: domain,
        content: 'route1.mx.cloudflare.net',
        priority: 1,
        ttl: 300,
      },
      {
        type: 'MX' as const,
        name: domain,
        content: 'route2.mx.cloudflare.net',
        priority: 2,
        ttl: 300,
      },
      {
        type: 'MX' as const,
        name: domain,
        content: 'route3.mx.cloudflare.net',
        priority: 3,
        ttl: 300,
      },
    ];

    const txtRecords = [
      {
        type: 'TXT' as const,
        name: domain,
        content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
        ttl: 300,
      },
    ];

    const createdMX = [];
    const createdTXT = [];

    for (const record of mxRecords) {
      try {
        const created = await this.createDNSRecord(record);
        createdMX.push(created);
      } catch (error) {
        console.error(`Failed to create MX record:`, error);
      }
    }

    for (const record of txtRecords) {
      try {
        const created = await this.createDNSRecord(record);
        createdTXT.push(created);
      } catch (error) {
        console.error(`Failed to create TXT record:`, error);
      }
    }

    return { mx: createdMX, txt: createdTXT };
  }

  // Verification
  async verifyEmailSetup(domain: string): Promise<{
    mxRecords: boolean;
    spfRecord: boolean;
    emailRouting: boolean;
  }> {
    try {
      const [dnsRecords, emailSettings] = await Promise.all([
        this.getDNSRecords(),
        this.getEmailRoutingSettings(),
      ]);

      const mxRecords = dnsRecords.filter(r => 
        r.type === 'MX' && 
        r.content?.includes('cloudflare.net')
      );

      const spfRecord = dnsRecords.find(r => 
        r.type === 'TXT' && 
        r.content?.includes('include:_spf.mx.cloudflare.net')
      );

      return {
        mxRecords: mxRecords.length >= 3,
        spfRecord: !!spfRecord,
        emailRouting: emailSettings?.enabled || false,
      };
    } catch (error) {
      console.error('Verification failed:', error);
      return {
        mxRecords: false,
        spfRecord: false,
        emailRouting: false,
      };
    }
  }

  // Test email functionality
  async testEmailRoute(email: string): Promise<boolean> {
    try {
      const routes = await this.getEmailRoutes();
      const route = routes.find(r => r.pattern === email || r.pattern === '*');
      return !!route?.enabled;
    } catch (error) {
      console.error('Test failed:', error);
      return false;
    }
  }
}

// Factory function for creating Cloudflare API instance
export function createCloudflareEmailAPI(): CloudflareEmailAPI | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    console.error('Missing Cloudflare configuration');
    return null;
  }

  return new CloudflareEmailAPI(apiToken, zoneId);
}

// Email routing configuration helpers
export const EMAIL_ROUTING_CONFIG = {
  domain: process.env.CLOUDFLARE_EMAIL_DOMAIN || 'subtracker.tech',
  webhookUrl: process.env.CLOUDFLARE_WEBHOOK_URL || 'https://subtracker.app/api/webhooks/cloudflare',
  workerScript: `
addEventListener('email', event => {
  event.waitUntil(handleEmail(event));
});

async function handleEmail(event) {
  const message = event.message;
  
  try {
    const response = await fetch('${process.env.CLOUDFLARE_WEBHOOK_URL}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cloudflare-Worker': 'true',
        'X-Webhook-Secret': '${process.env.CLOUDFLARE_WEBHOOK_SECRET}',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.headers.get('subject'),
        body: await message.text(),
        headers: Object.fromEntries(message.headers),
        timestamp: Date.now(),
      }),
    });
    
    if (!response.ok) {
      console.error('Webhook failed:', response.statusText);
    }
  } catch (error) {
    console.error('Email processing failed:', error);
  }
}
  `.trim(),
};