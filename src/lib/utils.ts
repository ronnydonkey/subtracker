import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function calculateNextBilling(
  currentDate: Date,
  billingCycle: 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'weekly'
): Date {
  const nextDate = new Date(currentDate);
  
  switch (billingCycle) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'semi-annually':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }
  
  return nextDate;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function getDaysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  
  const diffTime = d.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function getMonthlyAmount(
  amount: number,
  billingCycle: 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'weekly'
): number {
  switch (billingCycle) {
    case 'weekly':
      return amount * 4.33; // Average weeks per month
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'semi-annually':
      return amount / 6;
    case 'annually':
      return amount / 12;
    default:
      return amount;
  }
}

export function getYearlyAmount(
  amount: number,
  billingCycle: 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'weekly'
): number {
  switch (billingCycle) {
    case 'weekly':
      return amount * 52;
    case 'monthly':
      return amount * 12;
    case 'quarterly':
      return amount * 4;
    case 'semi-annually':
      return amount * 2;
    case 'annually':
      return amount;
    default:
      return amount;
  }
}

export function getBillingCycleLabel(
  cycle: 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'weekly'
): string {
  const labels = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    'semi-annually': 'Semi-annually',
    annually: 'Annually',
  };
  
  return labels[cycle] || cycle;
}

export function getStatusColor(status: string): string {
  const colors = {
    active: 'success',
    trial: 'info',
    cancelled: 'warning',
    expired: 'destructive',
    paused: 'secondary',
  } as const;
  
  return colors[status as keyof typeof colors] || 'default';
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function calculateTrialDaysRemaining(trialEndDate: string | Date): number {
  const endDate = typeof trialEndDate === 'string' ? new Date(trialEndDate) : trialEndDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

export function generateSubscriptionReport(subscriptions: any[]) {
  const totalActive = subscriptions.filter(s => s.status === 'active').length;
  const totalTrials = subscriptions.filter(s => s.status === 'trial').length;
  const totalCancelled = subscriptions.filter(s => s.status === 'cancelled').length;
  
  const monthlyTotal = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + getMonthlyAmount(s.cost, s.billing_cycle), 0);
    
  const yearlyTotal = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + getYearlyAmount(s.cost, s.billing_cycle), 0);

  return {
    totalSubscriptions: subscriptions.length,
    totalActive,
    totalTrials,
    totalCancelled,
    monthlyTotal,
    yearlyTotal,
    averageMonthlyCost: totalActive > 0 ? monthlyTotal / totalActive : 0,
  };
}

export function exportSubscriptionsToCSV(subscriptions: any[], filename?: string) {
  const headers = [
    'Service Name',
    'Cost',
    'Currency',
    'Billing Cycle',
    'Status',
    'Start Date',
    'Next Billing Date',
    'Trial End Date',
    'Category',
    'Website URL',
    'Cancellation URL',
    'Description',
    'Auto Renew',
    'Created At'
  ];

  const csvData = subscriptions.map(sub => [
    sub.service_name || '',
    sub.cost || 0,
    sub.currency || 'USD',
    sub.billing_cycle || '',
    sub.status || '',
    sub.start_date || '',
    sub.next_billing_date || '',
    sub.trial_end_date || '',
    sub.category?.name || '',
    sub.website_url || '',
    sub.cancellation_url || '',
    sub.description || '',
    sub.auto_renew ? 'Yes' : 'No',
    sub.created_at || ''
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `subscriptions_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function sortSubscriptions(subscriptions: any[], sortBy: string, ascending: boolean = true) {
  const sorted = [...subscriptions].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'service_name':
        aValue = a.service_name?.toLowerCase() || '';
        bValue = b.service_name?.toLowerCase() || '';
        return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        
      case 'cost':
        aValue = getMonthlyAmount(a.cost, a.billing_cycle);
        bValue = getMonthlyAmount(b.cost, b.billing_cycle);
        return ascending ? aValue - bValue : bValue - aValue;
        
      case 'next_billing_date':
        aValue = new Date(a.next_billing_date).getTime();
        bValue = new Date(b.next_billing_date).getTime();
        return ascending ? aValue - bValue : bValue - aValue;
        
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        return ascending ? aValue - bValue : bValue - aValue;
        
      default:
        return 0;
    }
  });
  
  return sorted;
}

export function filterSubscriptions(subscriptions: any[], filters: {
  search?: string;
  status?: string;
  category?: string;
  trialEndingSoon?: boolean;
  billingCycle?: string;
}) {
  return subscriptions.filter(sub => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const matches = 
        sub.service_name?.toLowerCase().includes(searchTerm) ||
        sub.description?.toLowerCase().includes(searchTerm) ||
        sub.category?.name?.toLowerCase().includes(searchTerm);
      if (!matches) return false;
    }
    
    // Status filter
    if (filters.status && sub.status !== filters.status) {
      return false;
    }
    
    // Category filter
    if (filters.category && sub.category?.name !== filters.category) {
      return false;
    }
    
    // Billing cycle filter
    if (filters.billingCycle && sub.billing_cycle !== filters.billingCycle) {
      return false;
    }
    
    // Trial ending soon filter
    if (filters.trialEndingSoon) {
      if (!sub.trial_end_date) return false;
      const daysRemaining = calculateTrialDaysRemaining(sub.trial_end_date);
      if (daysRemaining > 7) return false;
    }
    
    return true;
  });
}