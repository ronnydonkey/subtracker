'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { subscriptionSchema, type SubscriptionInput } from '@/lib/validations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { calculateNextBilling } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface SubscriptionFormProps {
  subscriptionId?: string;
}

export function SubscriptionForm({ subscriptionId }: SubscriptionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingData, setExistingData] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SubscriptionInput>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      currency: 'USD',
      billingCycle: 'monthly',
      status: 'active',
      autoRenew: true,
      notificationDaysBefore: 7,
      startDate: new Date(),
      nextBillingDate: new Date(),
    },
  });

  const watchedStartDate = watch('startDate');
  const watchedBillingCycle = watch('billingCycle');

  useEffect(() => {
    fetchCategories();
    if (subscriptionId) {
      fetchSubscription();
    }
  }, [subscriptionId]);

  useEffect(() => {
    if (watchedStartDate && watchedBillingCycle) {
      const nextDate = calculateNextBilling(watchedStartDate, watchedBillingCycle);
      setValue('nextBillingDate', nextDate);
    }
  }, [watchedStartDate, watchedBillingCycle, setValue]);

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

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`);
      if (response.ok) {
        const data = await response.json();
        setExistingData(data);
        
        // Set form values
        Object.keys(data).forEach((key) => {
          if (key === 'start_date' || key === 'next_billing_date' || key === 'trial_end_date') {
            setValue(key.replace('_', '') as any, new Date(data[key]));
          } else {
            setValue(key.replace('_', '') as any, data[key]);
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const onSubmit = async (data: SubscriptionInput) => {
    setLoading(true);
    
    try {
      const url = subscriptionId 
        ? `/api/subscriptions/${subscriptionId}`
        : '/api/subscriptions';
      
      const method = subscriptionId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push('/subscriptions');
      } else {
        const error = await response.json();
        console.error('Error saving subscription:', error);
      }
    } catch (error) {
      console.error('Failed to save subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {subscriptionId ? 'Edit Subscription' : 'Add New Subscription'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service Name *
              </label>
              <Input
                {...register('serviceName')}
                placeholder="Netflix, Spotify, etc."
                error={!!errors.serviceName}
              />
              {errors.serviceName && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.serviceName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <Select {...register('categoryId')}>
                <SelectOption value="">Select a category</SelectOption>
                {categories.map((category) => (
                  <SelectOption key={category.id} value={category.id}>
                    {category.name}
                  </SelectOption>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cost *
              </label>
              <Input
                {...register('cost', { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="9.99"
                error={!!errors.cost}
              />
              {errors.cost && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.cost.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency *
              </label>
              <Select {...register('currency')}>
                <SelectOption value="USD">USD ($)</SelectOption>
                <SelectOption value="EUR">EUR (€)</SelectOption>
                <SelectOption value="GBP">GBP (£)</SelectOption>
                <SelectOption value="CAD">CAD ($)</SelectOption>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Billing Cycle *
              </label>
              <Select {...register('billingCycle')}>
                <SelectOption value="weekly">Weekly</SelectOption>
                <SelectOption value="monthly">Monthly</SelectOption>
                <SelectOption value="quarterly">Quarterly</SelectOption>
                <SelectOption value="semi-annually">Semi-annually</SelectOption>
                <SelectOption value="annually">Annually</SelectOption>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date *
              </label>
              <Input
                {...register('startDate')}
                type="date"
                error={!!errors.startDate}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Next Billing Date *
              </label>
              <Input
                {...register('nextBillingDate')}
                type="date"
                error={!!errors.nextBillingDate}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status *
              </label>
              <Select {...register('status')}>
                <SelectOption value="active">Active</SelectOption>
                <SelectOption value="trial">Trial</SelectOption>
                <SelectOption value="paused">Paused</SelectOption>
                <SelectOption value="cancelled">Cancelled</SelectOption>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trial End Date
              </label>
              <Input
                {...register('trialEndDate')}
                type="date"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Additional notes about this subscription..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website URL
              </label>
              <Input
                {...register('websiteUrl')}
                type="url"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cancellation URL
              </label>
              <Input
                {...register('cancellationUrl')}
                type="url"
                placeholder="https://example.com/cancel"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notification Days Before
              </label>
              <Input
                {...register('notificationDaysBefore', { valueAsNumber: true })}
                type="number"
                min="0"
                max="30"
                placeholder="7"
              />
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                {...register('autoRenew')}
                type="checkbox"
                id="autoRenew"
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label
                htmlFor="autoRenew"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Auto-renew enabled
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : subscriptionId ? 'Update' : 'Add'} Subscription
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}