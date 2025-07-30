import { parseSubscriptionEmail, parseMultipleEmails } from './emailParser.js';
import { 
  normalizeServiceName, 
  detectBillingCycle, 
  formatCurrency,
  isTrialExpiringSoon,
  generateSubscriptionId,
  validateEmail
} from './utils.js';

export {
  parseSubscriptionEmail,
  parseMultipleEmails,
  normalizeServiceName,
  detectBillingCycle,
  formatCurrency,
  isTrialExpiringSoon,
  generateSubscriptionId,
  validateEmail
};

export default {
  parseEmail: parseSubscriptionEmail,
  parseEmails: parseMultipleEmails,
  utils: {
    normalizeServiceName,
    detectBillingCycle,
    formatCurrency,
    isTrialExpiringSoon,
    generateSubscriptionId,
    validateEmail
  }
};