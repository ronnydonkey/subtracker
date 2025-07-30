'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { AuthButton } from '@/components/auth/AuthButton';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';

interface HeaderProps {
  user: User | null;
  onMenuClick: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              onClick={onMenuClick}
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
            <h1 className="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
              SubTracker
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <Menu as="div" className="relative">
                <Menu.Button className="relative rounded-full p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                  <span className="sr-only">View notifications</span>
                  <BellIcon className="h-6 w-6" aria-hidden="true" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white dark:ring-gray-800" />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Notifications
                      </p>
                    </div>
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/notifications"
                          className={cn(
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <p className="font-medium">Trial ending soon</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Your Netflix trial ends in 3 days
                          </p>
                        </Link>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            )}
            
            <Menu as="div" className="relative">
              <div>
                <Menu.Button className="flex items-center">
                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.user_metadata?.full_name || user.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </p>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                        {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <AuthButton user={user} />
                  )}
                </Menu.Button>
              </div>
              
              {user && (
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/settings"
                          className={cn(
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                          )}
                        >
                          Settings
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/settings/billing"
                          className={cn(
                            active ? 'bg-gray-100 dark:bg-gray-700' : '',
                            'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                          )}
                        >
                          Billing
                        </Link>
                      )}
                    </Menu.Item>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <div className="px-4 py-2">
                      <AuthButton user={user} />
                    </div>
                  </Menu.Items>
                </Transition>
              )}
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}