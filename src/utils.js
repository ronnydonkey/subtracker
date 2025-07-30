export function normalizeServiceName(name) {
  if (!name || typeof name !== 'string') return 'Unknown';
  
  const commonAbbreviations = {
    'aws': 'Amazon Web Services',
    'gcp': 'Google Cloud Platform',
    'ms': 'Microsoft',
    'fb': 'Facebook',
    'ig': 'Instagram'
  };
  
  const normalized = name.trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
  
  const lower = normalized.toLowerCase();
  if (commonAbbreviations[lower]) {
    return commonAbbreviations[lower];
  }
  
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function categorizeSubscription(type, amount) {
  const categories = {
    essential: ['email', 'storage', 'backup', 'security'],
    productivity: ['project', 'task', 'calendar', 'office'],
    entertainment: ['music', 'video', 'game', 'stream'],
    learning: ['course', 'tutorial', 'education', 'training'],
    development: ['hosting', 'api', 'database', 'cloud'],
    communication: ['chat', 'video call', 'messaging'],
    other: []
  };
  
  if (amount) {
    if (amount < 10) return 'low-cost';
    if (amount < 50) return 'medium-cost';
    return 'high-cost';
  }
  
  return 'uncategorized';
}

export function calculateRenewalDate(startDate, billingCycle) {
  const date = new Date(startDate);
  
  switch (billingCycle) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'semi-annually':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'annually':
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  
  return date;
}

export function detectBillingCycle(emailContent) {
  const patterns = {
    monthly: /month(?:ly)?|every\s+month|per\s+month/i,
    annually: /annual(?:ly)?|year(?:ly)?|every\s+year|per\s+year/i,
    quarterly: /quarter(?:ly)?|every\s+3\s+months/i,
    weekly: /week(?:ly)?|every\s+week|per\s+week/i
  };
  
  for (const [cycle, pattern] of Object.entries(patterns)) {
    if (pattern.test(emailContent)) {
      return cycle;
    }
  }
  
  return 'monthly';
}

export function formatCurrency(amount, currency = 'USD') {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(amount);
}

export function isTrialExpiringSoon(trialEndDate, thresholdDays = 7) {
  if (!trialEndDate) return false;
  
  const endDate = new Date(trialEndDate);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry > 0 && daysUntilExpiry <= thresholdDays;
}

export function generateSubscriptionId(serviceName, email) {
  const timestamp = Date.now();
  const serviceSlug = serviceName.toLowerCase().replace(/\s+/g, '-');
  const emailHash = simpleHash(email);
  
  return `sub_${serviceSlug}_${emailHash}_${timestamp}`;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

export function validateEmail(email) {
  const requiredFields = ['subject', 'body', 'from'];
  const missingFields = requiredFields.filter(field => !email[field]);
  
  if (missingFields.length > 0) {
    return {
      isValid: false,
      errors: [`Missing required fields: ${missingFields.join(', ')}`]
    };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.from)) {
    return {
      isValid: false,
      errors: ['Invalid from email address']
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}