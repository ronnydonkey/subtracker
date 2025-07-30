'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SubscriptionCard } from './SubscriptionCard';
import { DeleteConfirmation } from './DeleteConfirmation';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

interface Subscription {
  id: string;
  service_name: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  status: string;
  next_billing_date: string;
  trial_end_date?: string;
  website_url?: string;
  cancellation_url?: string;
  category?: {
    name: string;
    color: string;
  };
}

interface Category {
  id: string;
  name: string;
}

export function SubscriptionList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('service_name');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterAndSortSubscriptions();
  }, [subscriptions, searchTerm, statusFilter, categoryFilter, sortBy]);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const filterAndSortSubscriptions = () => {
    let filtered = subscriptions.filter((sub) => {
      const matchesSearch = sub.service_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || sub.status === statusFilter;
      const matchesCategory = !categoryFilter || sub.category?.name === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });

    // Sort subscriptions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'service_name':
          return a.service_name.localeCompare(b.service_name);
        case 'cost':
          return b.cost - a.cost;
        case 'next_billing_date':
          return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredSubscriptions(filtered);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSubscriptions(subscriptions.filter(sub => sub.id !== id));
        setDeleteId(null);
      }
    } catch (error) {
      console.error('Failed to delete subscription:', error);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Service Name',
      'Cost',
      'Currency',
      'Billing Cycle',
      'Status',
      'Next Billing Date',
      'Category',
    ];

    const csvData = filteredSubscriptions.map(sub => [
      sub.service_name,
      sub.cost,
      sub.currency,
      sub.billing_cycle,
      sub.status,
      sub.next_billing_date,
      sub.category?.name || '',
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `subscriptions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search subscriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <SelectOption value="">All Statuses</SelectOption>
            <SelectOption value="active">Active</SelectOption>
            <SelectOption value="trial">Trial</SelectOption>
            <SelectOption value="paused">Paused</SelectOption>
            <SelectOption value="cancelled">Cancelled</SelectOption>
          </Select>

          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <SelectOption value="">All Categories</SelectOption>
            {categories.map((category) => (
              <SelectOption key={category.id} value={category.name}>
                {category.name}
              </SelectOption>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <SelectOption value="service_name">Sort by Name</SelectOption>
            <SelectOption value="cost">Sort by Cost</SelectOption>
            <SelectOption value="next_billing_date">Sort by Next Billing</SelectOption>
            <SelectOption value="status">Sort by Status</SelectOption>
          </Select>

          <Button variant="outline" onClick={exportToCSV}>
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
      </div>

      {/* Subscription Grid */}
      {filteredSubscriptions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <FunnelIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No subscriptions found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {subscriptions.length === 0
              ? "You haven't added any subscriptions yet."
              : 'Try adjusting your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <DeleteConfirmation
          subscriptionName={
            subscriptions.find(s => s.id === deleteId)?.service_name || ''
          }
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}