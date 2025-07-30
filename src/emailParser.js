import * as chrono from 'chrono-node';

const SUBSCRIPTION_PATTERNS = {
  trialStart: [
    /trial.{0,20}(starts?|begins?|activated|live)/i,
    /free.{0,20}trial.{0,20}(starts?|begins?)/i,
    /(\d+)[-\s]?days?.{0,20}free/i,
    /start.{0,20}your.{0,20}trial/i
  ],
  
  trialEnd: [
    /trial.{0,20}(ends?|expires?|expiring|ending)/i,
    /trial.{0,20}will.{0,20}(end|expire)/i,
    /(\d+).{0,20}days?.{0,20}left.{0,20}trial/i,
    /trial.{0,20}period.{0,20}(ends?|expires?)/i
  ],
  
  billing: [
    /bill(?:ing)?.{0,20}(date|cycle|period)/i,
    /next.{0,20}(payment|charge|bill)/i,
    /subscription.{0,20}renew/i,
    /auto[-\s]?renew/i,
    /recurring.{0,20}(payment|charge)/i
  ],
  
  cancellation: [
    /subscription.{0,20}(cancelled?|terminated)/i,
    /cancelled?.{0,20}your.{0,20}subscription/i,
    /no.{0,20}longer.{0,20}subscribed/i,
    /membership.{0,20}(cancelled?|ended)/i
  ],
  
  priceChange: [
    /price.{0,20}(change|increase|update)/i,
    /new.{0,20}pricing/i,
    /rate.{0,20}(change|increase)/i,
    /billing.{0,20}amount.{0,20}(change|update)/i
  ]
};

const AMOUNT_PATTERNS = [
  /\$\s*(\d+(?:\.\d{2})?)/g,
  /USD\s*(\d+(?:\.\d{2})?)/gi,
  /(\d+(?:\.\d{2})?)\s*USD/gi,
  /€\s*(\d+(?:\.\d{2})?)/g,
  /£\s*(\d+(?:\.\d{2})?)/g
];

const SERVICE_NAME_PATTERNS = [
  /thank\s+you\s+for\s+(?:subscribing|signing\s+up)\s+(?:to|for)\s+([A-Za-z0-9\s]+)/i,
  /your\s+([A-Za-z0-9\s]+)\s+(?:subscription|membership|account)/i,
  /welcome\s+to\s+([A-Za-z0-9\s]+)/i
];

function detectEmailType(emailContent) {
  const content = emailContent.subject + ' ' + emailContent.body;
  
  for (const [type, patterns] of Object.entries(SUBSCRIPTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return type;
      }
    }
  }
  
  return 'unknown';
}

function extractServiceName(email) {
  const content = email.subject + ' ' + email.body;
  
  for (const pattern of SERVICE_NAME_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  const domain = extractFromDomain(email.from);
  if (domain && domain !== 'unknown') {
    return domain;
  }
  
  const subjectWords = email.subject.split(/\s+/);
  for (const word of subjectWords) {
    if (word.length > 3 && /^[A-Z]/.test(word)) {
      return word;
    }
  }
  
  return 'Unknown Service';
}

function extractFromDomain(emailAddress) {
  if (!emailAddress) return 'unknown';
  
  const match = emailAddress.match(/@([^.]+)/);
  if (!match) return 'unknown';
  
  const domain = match[1].toLowerCase();
  
  const genericDomains = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email', 'noreply', 'no-reply'];
  if (genericDomains.includes(domain)) {
    const fullDomainMatch = emailAddress.match(/@(.+)$/);
    if (fullDomainMatch) {
      const parts = fullDomainMatch[1].split('.');
      for (const part of parts) {
        if (!genericDomains.includes(part.toLowerCase()) && part.length > 2) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        }
      }
    }
    return 'unknown';
  }
  
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

function extractDates(content) {
  const dates = chrono.parse(content);
  return dates.map(d => ({
    date: d.date(),
    text: d.text,
    confidence: d.tags ? 1.0 : 0.8
  }));
}

function extractTrialEndDate(email) {
  const content = email.subject + ' ' + email.body;
  
  const trialEndSection = content.match(/trial.{0,100}(end|expire).{0,100}/gi);
  if (trialEndSection) {
    const dates = extractDates(trialEndSection[0]);
    if (dates.length > 0) {
      return dates[0].date;
    }
  }
  
  const allDates = extractDates(content);
  const emailDate = new Date(email.date || Date.now());
  
  const futureDates = allDates.filter(d => d.date > emailDate);
  if (futureDates.length > 0) {
    return futureDates[0].date;
  }
  
  return null;
}

function extractAmount(email) {
  const content = email.subject + ' ' + email.body;
  const amounts = [];
  
  for (const pattern of AMOUNT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0 && amount < 10000) {
        amounts.push(amount);
      }
    }
  }
  
  if (amounts.length === 0) return null;
  
  amounts.sort((a, b) => a - b);
  const uniqueAmounts = [...new Set(amounts)];
  
  if (uniqueAmounts.length === 1) return uniqueAmounts[0];
  
  const mode = findMode(amounts);
  if (mode) return mode;
  
  return amounts[Math.floor(amounts.length / 2)];
}

function findMode(numbers) {
  const frequency = {};
  let maxFreq = 0;
  let mode = null;
  
  for (const num of numbers) {
    frequency[num] = (frequency[num] || 0) + 1;
    if (frequency[num] > maxFreq) {
      maxFreq = frequency[num];
      mode = num;
    }
  }
  
  return maxFreq > 1 ? mode : null;
}

function calculateConfidence(email, extractedData) {
  let confidence = 0;
  let factors = 0;
  
  if (extractedData.type !== 'unknown') {
    confidence += 0.3;
    factors++;
  }
  
  if (extractedData.serviceName !== 'Unknown Service') {
    confidence += 0.2;
    factors++;
  }
  
  if (extractedData.trialEndDate) {
    confidence += 0.2;
    factors++;
  }
  
  if (extractedData.billingAmount) {
    confidence += 0.2;
    factors++;
  }
  
  const hasMultiplePatternMatches = countPatternMatches(email) > 2;
  if (hasMultiplePatternMatches) {
    confidence += 0.1;
    factors++;
  }
  
  return factors > 0 ? confidence : 0;
}

function countPatternMatches(email) {
  const content = email.subject + ' ' + email.body;
  let matches = 0;
  
  for (const patterns of Object.values(SUBSCRIPTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) matches++;
    }
  }
  
  return matches;
}

export function parseSubscriptionEmail(email) {
  if (!email || (!email.subject && !email.body)) {
    throw new Error('Invalid email object: must have subject or body');
  }
  
  const type = detectEmailType(email);
  const serviceName = extractServiceName(email);
  const trialEndDate = extractTrialEndDate(email);
  const billingAmount = extractAmount(email);
  
  const extractedData = {
    type,
    serviceName,
    trialEndDate,
    billingAmount
  };
  
  const confidence = calculateConfidence(email, extractedData);
  
  return {
    ...extractedData,
    confidence,
    metadata: {
      emailDate: email.date || new Date().toISOString(),
      from: email.from,
      subject: email.subject
    }
  };
}

export function parseMultipleEmails(emails) {
  return emails.map(email => {
    try {
      return {
        success: true,
        data: parseSubscriptionEmail(email)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        email
      };
    }
  });
}

export const EmailParser = {
  parse: parseSubscriptionEmail,
  parseMultiple: parseMultipleEmails,
  patterns: SUBSCRIPTION_PATTERNS
};