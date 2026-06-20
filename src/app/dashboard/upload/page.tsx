'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DashboardHeader from '@/components/DashboardHeader';
import { UploadCloud, File, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth checking
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    setErrorMessage(null);
    if (!ALLOWED_TYPES.includes(selectedFile.type) && !selectedFile.name.endsWith('.mp3')) {
      setErrorMessage('Unsupported file format. Please upload MP4, MOV, MP3, or WAV.');
      return false;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage('File size exceeds the 100MB limit.');
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        if (!title) {
          // Set default title based on filename (removing extension)
          const baseName = droppedFile.name.substring(0, droppedFile.name.lastIndexOf('.')) || droppedFile.name;
          setTitle(baseName);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        if (!title) {
          const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
          setTitle(baseName);
        }
      }
    }
  };

  const triggerUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setStatus('uploading');
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      // 1. Ask API for a signed upload URL
      const urlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!urlResponse.ok) {
        const errJson = await urlResponse.json();
        throw new Error(errJson.error || 'Failed to get upload URL');
      }

      const { signedUrl, storagePath, meetingId } = await urlResponse.json();

      // 2. Upload file directly to Supabase storage using XMLHttpRequest for progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            resolve();
          } else {
            reject(new Error('Storage upload request failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload'));
        xhr.send(file);
      });

      // 3. Trigger processing
      setStatus('processing');
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          storagePath,
          title: title.trim(),
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!processResponse.ok) {
        const errJson = await processResponse.json();
        throw new Error(errJson.error || 'Failed to trigger background processing');
      }

      setStatus('success');
      // Redirect to dashboard shortly after success
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred during file upload');
    }
  };

  return (
    <div className="flex-grow flex flex-col min-h-screen bg-slate-950 text-foreground">
      <DashboardHeader />

      <main className="max-w-2xl mx-auto px-4 py-12 flex-grow w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" />
          Back to Dashboard
        </Link>

        <div className="bg-card border border-slate-800/80 p-8 rounded-2xl shadow-xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight">Upload Meeting Recording</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Add your MP4, MOV, MP3, or WAV files. Maximum size: 100MB.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2.5 mb-6">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm flex items-center gap-3 mb-6">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <div>
                <strong className="block text-white">Upload Complete!</strong>
                Redirecting to dashboard...
              </div>
            </div>
          )}

          <form onSubmit={triggerUpload} className="space-y-6">
            {/* Title field */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Meeting Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weekly Product Sync"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={status !== 'idle' && status !== 'error'}
                className="block w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all text-sm disabled:opacity-50"
              />
            </div>

            {/* Drag & Drop uploader zone */}
            {status === 'idle' || status === 'error' ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-60 ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : file
                    ? 'border-slate-700 bg-slate-900/10 hover:border-indigo-500/50'
                    : 'border-slate-800 bg-slate-950/20 hover:border-slate-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.mp3,.wav"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <>
                    <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                      <File className="h-6 w-6 text-indigo-400" />
                    </div>
                    <span className="text-sm font-semibold text-white max-w-sm truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 font-medium mt-3"
                    >
                      Remove File
                    </button>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-10 w-10 text-muted-foreground mb-3 opacity-60" />
                    <span className="text-sm text-gray-300 font-medium">
                      Drag & drop your file here, or{' '}
                      <span className="text-indigo-400 hover:text-indigo-300">browse</span>
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Supports audio and video recordings
                    </span>
                  </>
                )}
              </div>
            ) : (
              /* Loading and progress displays */
              <div className="border border-slate-800/80 rounded-2xl p-8 text-center bg-slate-900/10 flex flex-col items-center justify-center min-h-60">
                <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mb-4" />
                <h3 className="text-sm font-semibold text-white">
                  {status === 'uploading' ? 'Uploading recording...' : 'Starting meeting analysis...'}
                </h3>
                
                {status === 'uploading' && (
                  <div className="w-full max-w-xs mt-4">
                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground mt-2 block">
                      {uploadProgress}% uploaded
                    </span>
                  </div>
                )}

                {status === 'processing' && (
                  <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                    Speech-to-text transcription and note extraction is initializing. You can safely return to the dashboard; the process runs asynchronously in the background.
                  </p>
                )}
              </div>
            )}

            {/* Submit button */}
            {(status === 'idle' || status === 'error') && (
              <button
                type="submit"
                disabled={!file || !title.trim()}
                className="w-full py-3 px-4 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload and Analyze
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
