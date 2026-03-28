'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  IconDashboard,
  IconCar,
  IconId,
  IconUsers,
  IconFlag,
  IconClipboard,
  IconReceipt,
  IconLogOut,
} from './Icons';
import { ComponentType } from 'react';

const navItems: { href: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/drivers', label: 'Driver Verification', Icon: IconCar },
  { href: '/riders', label: 'Rider Documents', Icon: IconId },
  { href: '/users', label: 'Users', Icon: IconUsers },
  { href: '/flags', label: 'Flags', Icon: IconFlag },
  { href: '/posts', label: 'Posts', Icon: IconClipboard },
  { href: '/transactions', label: 'Transactions', Icon: IconReceipt },
];

export function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-forest-900 text-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-forest-700">
        <h1 className="text-xl font-bold">kanek</h1>
        <p className="text-forest-400 text-xs mt-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-accent-green/20 text-accent-green font-medium'
                  : 'text-gray-300 hover:bg-forest-700 hover:text-white'
              }`}
            >
              <item.Icon className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-forest-700 hover:text-white transition-colors"
        >
          <IconLogOut className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
