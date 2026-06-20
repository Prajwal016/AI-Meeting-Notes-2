'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DashboardHeader from '@/components/DashboardHeader';
import {
  FileText,
  Sparkles,
  ClipboardCheck,
  CheckSquare,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Calendar,
  User,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed';
  summary: string;
  transcript: string;
  created_at: string;
}

interface Decision {
  id: string;
  description: string;
}

interface ActionItem {
  id: string;
  description: string;
  assignee: string | null;
  deadline: string | null;
  is_completed: boolean;
}

interface Risk {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const meetingId = resolvedParams.id;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'decisions' | 'actions' | 'risks'>('summary');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        loadMeetingDetails();
      }
    };
    checkAuthAndLoad();
  }, [meetingId, router]);

  const loadMeetingDetails = async () => {
    try {
      setLoading(true);

      // Fetch meeting record
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (meetingError || !meetingData) throw new Error('Meeting not found');
      setMeeting(meetingData);

      // Fetch related decisions
      const { data: decisionsData } = await supabase
        .from('decisions')
        .select('*')
        .eq('meeting_id', meetingId);
      setDecisions(decisionsData || []);

      // Fetch related action items
      const { data: actionItemsData } = await supabase
        .from('action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });
      setActionItems(actionItemsData || []);

      // Fetch related risks
      const { data: risksData } = await supabase
        .from('risks')
        .select('*')
        .eq('meeting_id', meetingId);
      setRisks(risksData || []);

    } catch (err) {
      console.error(err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!meeting?.transcript) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleActionItem = async (itemId: string, currentStatus: boolean) => {
    try {
      // Optimistic state update
      setActionItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, is_completed: !currentStatus } : item))
      );

      const { error } = await supabase
        .from('action_items')
        .update({ is_completed: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update action item state:', err);
      // Revert state if error
      setActionItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, is_completed: currentStatus } : item))
      );
    }
  };

  const getSeverityColor = (severity: Risk['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-red-500/30 bg-red-500/5 text-red-400';
      case 'medium':
        return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
      case 'low':
        return 'border-slate-800 bg-slate-900/40 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-foreground flex flex-col">
        <DashboardHeader />
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  return (
    <div className="flex-grow flex flex-col min-h-screen bg-slate-950 text-foreground">
      <DashboardHeader />

      {/* Detail Header area */}
      <div className="border-b border-slate-900 bg-slate-900/30 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-4 group"
          >
            <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{meeting.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                  {new Date(meeting.created_at).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                  File name: {meeting.file_name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main split-pane content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Pane - Transcript */}
        <section className="lg:col-span-5 flex flex-col bg-card border border-slate-800/80 rounded-2xl overflow-hidden max-h-[calc(100vh-280px)]">
          <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/20 shrink-0">
            <h2 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              Meeting Transcript
            </h2>
            <button
              onClick={handleCopyTranscript}
              className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-6 overflow-y-auto text-sm text-gray-300 leading-relaxed font-sans select-text whitespace-pre-wrap">
            {meeting.transcript || 'No transcript generated.'}
          </div>
        </section>

        {/* Right Pane - Insights Tabs */}
        <section className="lg:col-span-7 flex flex-col bg-card border border-slate-800/80 rounded-2xl overflow-hidden max-h-[calc(100vh-280px)]">
          
          {/* Tab Buttons */}
          <div className="border-b border-slate-800 bg-slate-900/20 shrink-0 flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 min-w-[100px] text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'border-indigo-500 text-white bg-indigo-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Summary
            </button>

            <button
              onClick={() => setActiveTab('decisions')}
              className={`flex-1 min-w-[100px] text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'decisions'
                  ? 'border-indigo-500 text-white bg-indigo-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <ClipboardCheck className="h-4 w-4 text-indigo-400" />
              Decisions
            </button>

            <button
              onClick={() => setActiveTab('actions')}
              className={`flex-1 min-w-[100px] text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'actions'
                  ? 'border-indigo-500 text-white bg-indigo-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <CheckSquare className="h-4 w-4 text-indigo-400" />
              Actions
            </button>

            <button
              onClick={() => setActiveTab('risks')}
              className={`flex-1 min-w-[100px] text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'risks'
                  ? 'border-indigo-500 text-white bg-indigo-500/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-slate-900/30'
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-indigo-400" />
              Risks
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="p-6 overflow-y-auto flex-grow">
            
            {/* Tab: Summary */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2">Meeting Summary</h3>
                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {meeting.summary}
                </div>
              </div>
            )}

            {/* Tab: Decisions */}
            {activeTab === 'decisions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2">Key Decisions Made</h3>
                {decisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No specific decisions documented.</p>
                ) : (
                  <ul className="space-y-3">
                    {decisions.map((dec) => (
                      <li key={dec.id} className="flex items-start gap-3 bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-sm text-gray-300">
                        <div className="h-5 w-5 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 text-emerald-400 mt-0.5">
                          ✓
                        </div>
                        <span>{dec.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Tab: Actions */}
            {activeTab === 'actions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2">Action Items & Deliverables</h3>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No action items extracted.</p>
                ) : (
                  <ul className="space-y-3">
                    {actionItems.map((item) => (
                      <li
                        key={item.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                          item.is_completed
                            ? 'bg-slate-900/10 border-slate-800/40 opacity-60'
                            : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() => toggleActionItem(item.id, item.is_completed)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-black accent-indigo-500 shrink-0 cursor-pointer mt-1"
                        />
                        <div className="flex-grow space-y-2">
                          <span
                            className={`text-sm block leading-relaxed ${
                              item.is_completed ? 'line-through text-gray-500' : 'text-gray-200'
                            }`}
                          >
                            {item.description}
                          </span>
                          
                          {(item.assignee || item.deadline) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              {item.assignee && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-gray-300 border border-slate-700 rounded-md">
                                  <User className="h-3 w-3 mr-1 text-indigo-400" />
                                  {item.assignee}
                                </span>
                              )}
                              {item.deadline && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-gray-300 border border-slate-700 rounded-md">
                                  <Calendar className="h-3 w-3 mr-1 text-indigo-400" />
                                  {item.deadline}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Tab: Risks */}
            {activeTab === 'risks' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2">Blockers & Risk Mitigation</h3>
                {risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No blockers or risks flagged.</p>
                ) : (
                  <div className="space-y-3">
                    {risks.map((risk) => (
                      <div
                        key={risk.id}
                        className={`p-4 rounded-xl border flex items-start gap-3 text-sm leading-relaxed ${getSeverityColor(
                          risk.severity
                        )}`}
                      >
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-inherit" />
                        <div>
                          <strong className="block text-xs uppercase tracking-wider font-semibold opacity-75 mb-0.5">
                            {risk.severity} Severity Risk
                          </strong>
                          <span>{risk.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </section>

      </main>
    </div>
  );
}
