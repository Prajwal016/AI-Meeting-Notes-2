'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Video, LogOut, LayoutDashboard, UploadCloud } from 'lucide-react';
import Link from 'next/link';

export default function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Branding Logo */}
        <Link href="/dashboard" className="flex items-center space-x-2.5 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Video className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight group-hover:text-indigo-400 transition-colors">
            AI Meeting Intelligence
          </span>
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center space-x-6">
          <nav className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === '/dashboard'
                  ? 'bg-slate-905 text-white bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/dashboard/upload"
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === '/dashboard/upload'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload</span>
            </Link>
          </nav>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </header>
  );
}
