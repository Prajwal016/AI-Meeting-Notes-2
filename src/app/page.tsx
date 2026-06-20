'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Video, ArrowRight, Shield, Clock, BrainCircuit, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black overflow-hidden relative">
      
      {/* Visual background details */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              AI Meeting Intelligence
            </span>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-gray-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/80 px-4.5 py-2 rounded-xl transition-all"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex-grow flex flex-col justify-center items-center text-center relative z-10">
        
        {/* Main CTA */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
          <BrainCircuit className="h-3.5 w-3.5" />
          Powered by Whisper & GPT-4o
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-3xl leading-tight">
          Turn your meeting recordings into{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Actionable Intelligence
          </span>
        </h1>

        <p className="mt-6 text-lg text-gray-400 max-w-xl leading-relaxed">
          Upload audio or video files and let AI generate transcripts, structured summaries, key decisions, and deadline-tracked task checklists.
        </p>

        <div className="mt-10">
          <Link
            href="/login"
            className="group inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-indigo-500/30 scale-100 hover:scale-[1.02]"
          >
            Get Started For Free
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full max-w-5xl">
          <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl text-left backdrop-blur-sm">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400 border border-indigo-500/20">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Automated Insights</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Whisper transcriber and advanced LLMs isolate decisions, assignees, deadlines, and project risks directly from sound.
            </p>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl text-left backdrop-blur-sm">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400 border border-purple-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Secure Isolation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Row Level Security ensures your business transcripts and audio clips remain accessible only to authorized stakeholders.
            </p>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl text-left backdrop-blur-sm">
            <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4 text-pink-400 border border-pink-500/20">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">30-day Retention</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Automated data policies clear raw media uploads and summaries after 30 days to optimize resources and support compliance.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AI Meeting Intelligence Assistant. All rights reserved.
      </footer>
    </div>
  );
}
