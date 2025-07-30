# SubTracker - Email Parsing Service for Subscription Management

A robust email parsing service that automatically extracts subscription information from emails, including trial periods, billing amounts, and renewal dates.

## Features

- **Intelligent Pattern Matching**: Detects various subscription-related emails (trials, billing, cancellations, price changes)
- **Date Extraction**: Uses advanced date parsing to identify trial end dates and billing cycles
- **Amount Detection**: Extracts subscription costs with support for multiple currencies
- **Service Name Recognition**: Intelligently identifies service names from email content and sender addresses
- **Confidence Scoring**: Provides confidence levels for extracted data
- **Batch Processing**: Process multiple emails efficiently
- **Utility Functions**: Includes helpers for formatting, validation, and subscription management

## Installation

```bash
npm install
```

## Usage

### Basic Email Parsing

```javascript
import { parseSubscriptionEmail } from './src/index.js';

const email = {
  from: 'noreply@netflix.com',
  subject: 'Your free trial is ending soon',
  body: 'Your Netflix free trial will end on December 15, 2024. After this date, you\'ll be charged $15.99 per month.',
  date: '2024-12-08T10:00:00Z'
};

const result = parseSubscriptionEmail(email);
console.log(result);
// Output:
// {
//   type: 'trialEnd',
//   serviceName: 'Netflix',
//   trialEndDate: '2024-12-15T00:00:00.000Z',
//   billingAmount: 15.99,
//   confidence: 0.9,
//   metadata: { ... }
// }
```

### Batch Processing

```javascript
import { parseMultipleEmails } from './src/index.js';

const emails = [/* array of email objects */];
const results = parseMultipleEmails(emails);
```

### Utility Functions

```javascript
import { 
  normalizeServiceName,
  detectBillingCycle,
  formatCurrency,
  isTrialExpiringSoon
} from './src/utils.js';

// Normalize service names
normalizeServiceName('aws'); // 'Amazon Web Services'

// Detect billing cycles
detectBillingCycle('You will be charged monthly'); // 'monthly'

// Format currency
formatCurrency(29.99); // '$29.99'

// Check if trial expires soon
isTrialExpiringSoon('2024-12-15', 7); // true/false
```

## API Reference

### `parseSubscriptionEmail(email)`

Parses a single email and extracts subscription information.

**Parameters:**
- `email` (Object): Email object with `from`, `subject`, `body`, and optional `date` fields

**Returns:**
- Object containing:
  - `type`: Email type (trialStart, trialEnd, billing, cancellation, priceChange, unknown)
  - `serviceName`: Detected service name
  - `trialEndDate`: Trial expiration date (if applicable)
  - `billingAmount`: Subscription cost (if found)
  - `confidence`: Confidence score (0-1)
  - `metadata`: Original email information

### `parseMultipleEmails(emails)`

Processes multiple emails and returns results with error handling.

**Parameters:**
- `emails` (Array): Array of email objects

**Returns:**
- Array of result objects with `success` status and either `data` or `error`

## Running Examples

```bash
# Test with sample emails
node examples/test-emails.js

# See usage examples
node examples/usage.js
```

## Email Object Format

```javascript
{
  from: 'sender@example.com',    // Required
  subject: 'Email subject',      // Required
  body: 'Email body content',    // Required
  date: '2024-12-08T10:00:00Z'  // Optional (ISO string or Date object)
}
```

## Supported Patterns

The service recognizes various subscription-related patterns:

- **Trial Start**: "trial starts", "free trial activated", "14-day free"
- **Trial End**: "trial ends", "trial expires in X days"
- **Billing**: "billing date", "next payment", "subscription renews"
- **Cancellation**: "subscription cancelled", "membership ended"
- **Price Changes**: "price increase", "new pricing"

## License

MIT
