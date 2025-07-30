import { parseSubscriptionEmail } from '../emailParser.js';

export interface EmailData {
  from: string;
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: Date;
  messageId?: string;
  headers?: Record<string, string>;
}

export interface DetectedSubscription {
  serviceName: string;
  detectionType: 'trial_signup' | 'trial_reminder' | 'billing_confirmation' | 'subscription_start' | 'price_change';
  confidence: number;
  cost?: number;
  currency?: string;
  billingCycle?: string;
  trialEndDate?: Date;
  nextBillingDate?: Date;
  extractedData: Record<string, any>;
}

export class EmailSubscriptionParser {
  private static readonly TRIAL_SIGNUP_PATTERNS = [
    /welcome.*trial/i,
    /trial.*started/i,
    /free.*trial.*activated/i,
    /trial.*period.*begins/i,
    /start.*your.*trial/i,
    /trial.*subscription.*created/i,
    /(\d+)[-\s]*days?.*free/i,
  ];

  private static readonly TRIAL_REMINDER_PATTERNS = [
    /trial.*end(?:s|ing)/i,
    /trial.*expir(?:es|ing)/i,
    /(\d+).*days?.*left.*trial/i,
    /trial.*will.*end/i,
    /subscription.*will.*begin/i,
    /trial.*period.*ending/i,
  ];

  private static readonly BILLING_CONFIRMATION_PATTERNS = [
    /payment.*successful/i,
    /subscription.*renewed/i,
    /billing.*confirmation/i,
    /receipt.*for.*subscription/i,
    /charged.*for.*subscription/i,
    /payment.*processed/i,
    /invoice.*for.*subscription/i,
  ];

  private static readonly SUBSCRIPTION_START_PATTERNS = [
    /subscription.*activated/i,
    /welcome.*subscriber/i,
    /subscription.*started/i,
    /membership.*activated/i,
    /account.*upgraded/i,
    /premium.*activated/i,
  ];

  private static readonly PRICE_CHANGE_PATTERNS = [
    /price.*change/i,
    /pricing.*update/i,
    /subscription.*cost.*chang/i,
    /new.*pricing/i,
    /rate.*increase/i,
    /billing.*amount.*chang/i,
  ];

  private static readonly SPAM_PATTERNS = [
    /unsubscribe.*here/i,
    /click.*here.*now/i,
    /limited.*time.*offer/i,
    /act.*now/i,
    /congratulations.*you.*won/i,
    /claim.*your.*prize/i,
  ];

  private static readonly COMMON_SUBSCRIPTION_SERVICES = [
    'netflix', 'spotify', 'amazon', 'apple', 'google', 'microsoft', 'adobe',
    'dropbox', 'slack', 'zoom', 'salesforce', 'hubspot', 'mailchimp',
    'canva', 'figma', 'notion', 'airtable', 'calendly', 'loom', 'discord',
    'twitch', 'youtube', 'hulu', 'disney', 'hbo', 'paramount', 'peacock',
    'github', 'gitlab', 'vercel', 'netlify', 'heroku', 'digitalocean',
  ];

  static async parseEmail(emailData: EmailData): Promise<DetectedSubscription[]> {
    const content = this.getEmailContent(emailData);
    const detections: DetectedSubscription[] = [];

    // Check if email is spam
    if (this.isSpamEmail(content, emailData.from)) {
      return detections;
    }

    // Extract service name
    const serviceName = this.extractServiceName(emailData.from, content);
    
    if (!serviceName) {
      return detections;
    }

    // Detect different types of subscription emails
    const trialSignup = this.detectTrialSignup(content, serviceName);
    if (trialSignup) detections.push(trialSignup);

    const trialReminder = this.detectTrialReminder(content, serviceName);
    if (trialReminder) detections.push(trialReminder);

    const billingConfirmation = this.detectBillingConfirmation(content, serviceName);
    if (billingConfirmation) detections.push(billingConfirmation);

    const subscriptionStart = this.detectSubscriptionStart(content, serviceName);
    if (subscriptionStart) detections.push(subscriptionStart);

    const priceChange = this.detectPriceChange(content, serviceName);
    if (priceChange) detections.push(priceChange);

    return detections;
  }

  private static getEmailContent(emailData: EmailData): string {
    return `${emailData.subject} ${emailData.bodyText || ''} ${emailData.bodyHtml || ''}`;
  }

  private static isSpamEmail(content: string, from: string): boolean {
    // Check for spam patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Check sender reputation (basic)
    const suspiciousDomains = ['tempmail', 'guerrillamail', '10minutemail'];
    const domain = from.split('@')[1]?.toLowerCase();
    
    return suspiciousDomains.some(suspicious => domain?.includes(suspicious));
  }

  private static extractServiceName(from: string, content: string): string | null {
    // Extract from sender domain
    const domain = from.split('@')[1]?.toLowerCase().replace(/^(mail\.|noreply\.|no-reply\.)/, '');
    
    if (domain) {
      // Check against known services
      for (const service of this.COMMON_SUBSCRIPTION_SERVICES) {
        if (domain.includes(service)) {
          return service.charAt(0).toUpperCase() + service.slice(1);
        }
      }
      
      // Extract company name from domain
      const companyName = domain.split('.')[0];
      if (companyName && companyName.length > 2) {
        return companyName.charAt(0).toUpperCase() + companyName.slice(1);
      }
    }

    // Extract from email content
    const servicePatterns = [
      /thank you for subscribing to ([A-Za-z0-9\s]+)/i,
      /welcome to ([A-Za-z0-9\s]+)/i,
      /your ([A-Za-z0-9\s]+) subscription/i,
      /([A-Za-z0-9\s]+) membership/i,
    ];

    for (const pattern of servicePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private static detectTrialSignup(content: string, serviceName: string): DetectedSubscription | null {
    for (const pattern of this.TRIAL_SIGNUP_PATTERNS) {
      if (pattern.test(content)) {
        const extractedData = this.extractSubscriptionData(content);
        return {
          serviceName,
          detectionType: 'trial_signup',
          confidence: this.calculateConfidence(content, 'trial_signup'),
          ...extractedData,
          extractedData: { rawContent: content.substring(0, 500) },
        };
      }
    }
    return null;
  }

  private static detectTrialReminder(content: string, serviceName: string): DetectedSubscription | null {
    for (const pattern of this.TRIAL_REMINDER_PATTERNS) {
      if (pattern.test(content)) {
        const extractedData = this.extractSubscriptionData(content);
        return {
          serviceName,
          detectionType: 'trial_reminder',
          confidence: this.calculateConfidence(content, 'trial_reminder'),
          ...extractedData,
          extractedData: { rawContent: content.substring(0, 500) },
        };
      }
    }
    return null;
  }

  private static detectBillingConfirmation(content: string, serviceName: string): DetectedSubscription | null {
    for (const pattern of this.BILLING_CONFIRMATION_PATTERNS) {
      if (pattern.test(content)) {
        const extractedData = this.extractSubscriptionData(content);
        return {
          serviceName,
          detectionType: 'billing_confirmation',
          confidence: this.calculateConfidence(content, 'billing_confirmation'),
          ...extractedData,
          extractedData: { rawContent: content.substring(0, 500) },
        };
      }
    }
    return null;
  }

  private static detectSubscriptionStart(content: string, serviceName: string): DetectedSubscription | null {
    for (const pattern of this.SUBSCRIPTION_START_PATTERNS) {
      if (pattern.test(content)) {
        const extractedData = this.extractSubscriptionData(content);
        return {
          serviceName,
          detectionType: 'subscription_start',
          confidence: this.calculateConfidence(content, 'subscription_start'),
          ...extractedData,
          extractedData: { rawContent: content.substring(0, 500) },
        };
      }
    }
    return null;
  }

  private static detectPriceChange(content: string, serviceName: string): DetectedSubscription | null {
    for (const pattern of this.PRICE_CHANGE_PATTERNS) {
      if (pattern.test(content)) {
        const extractedData = this.extractSubscriptionData(content);
        return {
          serviceName,
          detectionType: 'price_change',
          confidence: this.calculateConfidence(content, 'price_change'),
          ...extractedData,
          extractedData: { rawContent: content.substring(0, 500) },
        };
      }
    }
    return null;
  }

  private static extractSubscriptionData(content: string): Partial<DetectedSubscription> {
    const data: Partial<DetectedSubscription> = {};

    // Extract cost
    const costPatterns = [
      /\$(\d+(?:\.\d{2})?)/,
      /(\d+(?:\.\d{2})?)\s*USD/i,
      /€(\d+(?:\.\d{2})?)/,
      /£(\d+(?:\.\d{2})?)/,
    ];

    for (const pattern of costPatterns) {
      const match = content.match(pattern);
      if (match) {
        data.cost = parseFloat(match[1]);
        data.currency = this.extractCurrency(match[0]);
        break;
      }
    }

    // Extract billing cycle
    const cyclePatterns = [
      /monthly/i,
      /quarterly/i,
      /annually/i,
      /yearly/i,
      /weekly/i,
    ];

    for (const pattern of cyclePatterns) {
      if (pattern.test(content)) {
        data.billingCycle = pattern.source.toLowerCase().replace('ly', '');
        break;
      }
    }

    // Extract dates using existing email parser
    try {
      const emailObj = {
        from: '',
        subject: content.substring(0, 100),
        body: content,
      };
      
      const parsed = parseSubscriptionEmail(emailObj);
      if (parsed.trialEndDate) {
        data.trialEndDate = new Date(parsed.trialEndDate);
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return data;
  }

  private static extractCurrency(text: string): string {
    if (text.includes('$') || text.includes('USD')) return 'USD';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    return 'USD';
  }

  private static calculateConfidence(content: string, type: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on multiple pattern matches
    const patternCounts = {
      trial_signup: this.TRIAL_SIGNUP_PATTERNS.filter(p => p.test(content)).length,
      trial_reminder: this.TRIAL_REMINDER_PATTERNS.filter(p => p.test(content)).length,
      billing_confirmation: this.BILLING_CONFIRMATION_PATTERNS.filter(p => p.test(content)).length,
      subscription_start: this.SUBSCRIPTION_START_PATTERNS.filter(p => p.test(content)).length,
      price_change: this.PRICE_CHANGE_PATTERNS.filter(p => p.test(content)).length,
    };

    const currentTypeMatches = patternCounts[type as keyof typeof patternCounts] || 0;
    confidence += currentTypeMatches * 0.1;

    // Increase confidence if cost is found
    if (/\$\d+|\d+.*USD|€\d+|£\d+/i.test(content)) {
      confidence += 0.2;
    }

    // Increase confidence if billing cycle is mentioned
    if (/monthly|quarterly|annually|yearly|weekly/i.test(content)) {
      confidence += 0.1;
    }

    // Increase confidence if date is mentioned
    if (/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december/i.test(content)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}