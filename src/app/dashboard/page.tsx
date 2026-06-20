'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DashboardHeader from '@/components/DashboardHeader';
import { Search, Loader2, Calendar, FileText, CheckSquare, AlertCircle, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'downloading' | 'transcribing' | 'saving' | 'completed' | 'failed';
  summary: string;
  created_at: string;
  expires_at: string;
  action_items?: { count: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Authenticate user on client side
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setUser(session.user);
        fetchMeetings();
      }
    };
    checkAuth();
  }, [router]);

  // Poll for meetings status while any are processing
  useEffect(() => {
    const hasProcessing = meetings.some((m) =>
      ['processing', 'downloading', 'transcribing', 'saving'].includes(m.status)
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchMeetings(true);
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(interval);
  }, [meetings]);

  const fetchMeetings = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      // Fetch meetings and count associated action items
      const { data, error } = await supabase
        .from('meetings')
        .select('*, action_items(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Client-side search matching against title or summary
  const filteredMeetings = meetings.filter((meeting) => {
    const titleMatch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase());
    const summaryMatch = meeting.summary?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return titleMatch || summaryMatch;
  });

  const getStatusBadge = (status: Meeting['status']) => {
    switch (status) {
      case 'downloading':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Loader2 className="animate-spin h-3 w-3 mr-1" />
            Downloading...
          </span>
        );
      case 'transcribing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Loader2 className="animate-spin h-3 w-3 mr-1" />
            Transcribing...
          </span>
        );
      case 'saving':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="animate-spin h-3 w-3 mr-1" />
            Saving Insights...
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="animate-spin h-3 w-3 mr-1" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-grow flex flex-col min-h-screen bg-slate-950 text-foreground">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Banner Area */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 border border-slate-800/80 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Your Meeting Notebook</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload recordings and convert discussions into insights. Cleaned up automatically after 30 days.
            </p>
          </div>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-indigo-500/20"
          >
            Upload Recording
          </Link>
        </div>

        {/* Dashboard Tools (Search & Count) */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
          <div className="relative flex-grow max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Search meetings by title or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
          <div className="text-sm text-muted-foreground bg-slate-900/40 border border-slate-800 px-4 py-2 rounded-xl flex items-center justify-center">
            Total meetings: <strong className="text-white ml-1.5">{filteredMeetings.length}</strong>
          </div>
        </div>

        {/* Meeting Grid */}
        {loading ? (
          <div className="flex-1 flex justify-center items-center py-24">
            <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-white">No meetings found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery ? 'Try adjusting your search terms.' : 'Upload your first audio or video recording to get started.'}
            </p>
            {!searchQuery && (
              <Link
                href="/dashboard/upload"
                className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Upload your first file <ChevronRight className="h-4 w-4 ml-0.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMeetings.map((meeting) => {
              const actionCount = meeting.action_items?.[0]?.count || 0;
              const isProcessing = ['processing', 'downloading', 'transcribing', 'saving'].includes(meeting.status);
              const isFailed = meeting.status === 'failed';

              return (
                <div
                  key={meeting.id}
                  className={`bg-card border rounded-2xl p-5 hover:-translate-y-1 transition-all shadow-md group ${
                    isFailed ? 'border-red-500/20 hover:border-red-500/30' : 'border-slate-800/80 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      {new Date(meeting.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    {getStatusBadge(meeting.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white line-clamp-1 mb-2 group-hover:text-indigo-400 transition-colors">
                    {meeting.title}
                  </h3>

                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                    <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px]">
                      {meeting.file_type.split('/')[1]?.toUpperCase() || 'MEDIA'}
                    </span>
                    <span>{formatBytes(meeting.file_size)}</span>
                  </p>

                  <p className="text-sm text-gray-400 line-clamp-3 mb-6 h-15">
                    {meeting.status === 'downloading'
                      ? 'Downloading meeting recording from storage...'
                      : meeting.status === 'transcribing'
                      ? 'AI is transcribing and extracting meeting notes...'
                      : meeting.status === 'saving'
                      ? 'Finalizing and generating action items, decisions, and risks...'
                      : isProcessing
                      ? 'AI transcription and notes generation is currently processing in the background...'
                      : isFailed
                      ? 'Processing encountered an error. Please check the file format or upload another file.'
                      : meeting.summary}
                  </p>

                  <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs">
                    <div className="flex items-center text-muted-foreground">
                      <CheckSquare className="h-4 w-4 mr-1 text-indigo-400" />
                      <span>{actionCount} Action Items</span>
                    </div>

                    {!isProcessing && !isFailed ? (
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center"
                      >
                        View Notes <ChevronRight className="h-4 w-4 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/40 italic">Unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
