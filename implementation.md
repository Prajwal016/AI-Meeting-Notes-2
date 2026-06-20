# Technical Implementation Document

## AI Meeting Intelligence Assistant – Phase 2

**Version:** 1.0.0  
**Status:** Ready for Execution  
**Target Architecture:** Next.js (App Router) + Supabase (Database, Auth, Storage) + OpenAI API (Whisper, GPT-4o-mini)  

---

## 1. Project Directory Structure

We will implement a standard Next.js App Router structure in TypeScript:

```
├── .agents/                    # Agent skills and lockfiles
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root Layout (Google Font: Outfit, Inter)
│   │   ├── page.tsx            # Landing Page / Redirection Logic
│   │   ├── login/
│   │   │   └── page.tsx        # Supabase Auth Login / Signup Form
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Meeting List Dashboard & Search
│   │   │   └── upload/
│   │   │       └── page.tsx    # Recording Uploader Panel
│   │   ├── meetings/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Split-Pane Meeting Details View
│   │   └── api/
│   │       ├── upload-url/
│   │       │   └── route.ts    # API: Generates secure storage pre-signed URLs
│   │       ├── process/
│   │       │   └── route.ts    # API: Triggers Whisper transcription & LLM summarization
│   │       └── cron-cleanup/
│   │           └── route.ts    # API: Triggers 30-day data retention cleanup
│   ├── components/
│   │   ├── ui/                 # Shadcn UI base primitives (Button, Card, Progress)
│   │   ├── DashboardHeader.tsx # Dashboard navigation and user menu
│   │   ├── UploadZone.tsx      # Drag & Drop upload with progress indicator
│   │   └── MeetingCard.tsx     # Single meeting display card
│   ├── lib/
│   │   ├── supabaseClient.ts   # Client-side Supabase init
│   │   ├── supabaseServer.ts   # Server-side Supabase client (using cookies)
│   │   └── openai.ts           # OpenAI client wrapper
│   └── types/
│       └── database.types.ts   # Generated Supabase DB types
├── supabase/
│   ├── migrations/
│   │   └── 20260619_initial_schema.sql  # SQL schema, triggers, and RLS policies
│   └── config.toml
├── prd.md
├── srs.md
└── package.json
```

---

## 2. Database Schema & Supabase Setup

### 2.1 Schema Definition SQL
Create a migration file at `supabase/migrations/20260619_initial_schema.sql` to define the database tables.

```sql
-- Create Meetings Table
CREATE TABLE public.meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'processing' NOT NULL, -- 'processing', 'completed', 'failed'
    transcript TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '30 days') NOT NULL
);

-- Create Action Items Table
CREATE TABLE public.action_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    assignee VARCHAR(255),
    deadline DATE,
    is_completed BOOLEAN DEFAULT false NOT NULL
);

-- Create Decisions Table
CREATE TABLE public.decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL
);

-- Create Risks Table
CREATE TABLE public.risks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'medium' NOT NULL -- 'low', 'medium', 'high'
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can only view/manage their own meetings"
    ON public.meetings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access actions of their meetings"
    ON public.action_items
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = action_items.meeting_id AND meetings.user_id = auth.uid()
    ));

CREATE POLICY "Users can only access decisions of their meetings"
    ON public.decisions
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = decisions.meeting_id AND meetings.user_id = auth.uid()
    ));

CREATE POLICY "Users can only access risks of their meetings"
    ON public.risks
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE meetings.id = risks.meeting_id AND meetings.user_id = auth.uid()
    ));
```

### 2.2 Storage Bucket Setup
Create a bucket named `recordings` in Supabase:
- **Private Access**: Enabled.
- **Allowed MIME types**: `video/mp4`, `video/quicktime` (for MOV), `audio/mpeg` (for MP3), `audio/wav`, `audio/x-wav`.
- **Policy**:
  - Insert: Permitted for authenticated users where path starts with `auth.uid() + '/'`.
  - Read: Permitted for authenticated users where path starts with `auth.uid() + '/'`.

---

## 3. Serverless API Routing & AI Workflows

### 3.1 Upload Flow (Next.js API & Client)
To prevent serverless timeout limits on Vercel, the client requests a pre-signed URL from Supabase Storage and uploads the file directly from the browser.

```typescript
// src/app/api/upload-url/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fileName, fileType } = await request.json();
  const meetingId = crypto.randomUUID();
  const storagePath = `${user.id}/${meetingId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('recordings')
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    signedUrl: data.signedUrl,
    storagePath,
    meetingId
  });
}
```

### 3.2 Processing Flow (Speech-to-Text & LLM Summarizer)
Once uploaded, the client triggers the background execution of the transcription and GPT analysis API.

```typescript
// src/app/api/process/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { meetingId, storagePath, title, fileName, fileType, fileSize } = await request.json();

  // Create temporary record in status 'processing'
  await supabase.from('meetings').insert({
    id: meetingId,
    user_id: user.id,
    title,
    file_name: fileName,
    storage_path: storagePath,
    file_type: fileType,
    file_size: fileSize,
    status: 'processing'
  });

  try {
    // 1. Download file from Supabase Storage to memory / temporary space
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('recordings')
      .download(storagePath);

    if (downloadError) throw new Error(downloadError.message);

    // Save temporary file locally for OpenAI SDK
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const tempFilePath = path.join(tempDir, `${meetingId}-${fileName}`);
    fs.writeFileSync(tempFilePath, Buffer.from(await fileData.arrayBuffer()));

    // 2. Call OpenAI Whisper API for Transcription
    const transcriptResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    const transcriptText = transcriptResponse.text;

    // Clean up temporary local file
    fs.unlinkSync(tempFilePath);

    // 3. Call OpenAI GPT-4o-mini to Extract Intelligence
    const systemPrompt = `You are a professional business analyst. Analyze the following meeting transcript.
Provide output as a raw JSON object with the following fields:
- summary (string, paragraphs mapping the main objectives, discussion flow, and key highlights)
- decisions (array of strings, key alignments reached)
- actionItems (array of objects with fields: 'description' [string], 'assignee' [string or null], 'deadline' [string or null as YYYY-MM-DD])
- risks (array of objects with fields: 'description' [string], 'severity' [string: 'low' | 'medium' | 'high'])
Do not include any markdown styling like \`\`\`json in your response.`;

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcriptText }
      ],
      response_format: { type: 'json_object' }
    });

    const intelligence = JSON.parse(gptResponse.choices[0].message.content || '{}');

    // 4. Save Insights and update Status
    await supabase.from('meetings').update({
      transcript: transcriptText,
      summary: intelligence.summary,
      status: 'completed'
    }).eq('id', meetingId);

    // Insert Decisions
    if (intelligence.decisions?.length) {
      await supabase.from('decisions').insert(
        intelligence.decisions.map((d: string) => ({ meeting_id: meetingId, description: d }))
      );
    }

    // Insert Action Items
    if (intelligence.actionItems?.length) {
      await supabase.from('action_items').insert(
        intelligence.actionItems.map((a: any) => ({
          meeting_id: meetingId,
          description: a.description,
          assignee: a.assignee,
          deadline: a.deadline
        }))
      );
    }

    // Insert Risks
    if (intelligence.risks?.length) {
      await supabase.from('risks').insert(
        intelligence.risks.map((r: any) => ({
          meeting_id: meetingId,
          description: r.description,
          severity: r.severity
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Update status to failed in database
    await supabase.from('meetings').update({
      status: 'failed'
    }).eq('id', meetingId);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 4. Frontend & User Interface Implementation

### 4.1 UI Style Guidelines
- **Theme**: Premium Dark Theme
  - Background: Deep gray/violet HSL `224 71% 4%`
  - Cards / Sections: HSL `224 71% 7%`
  - Accent / Actions: Indigo gradient (`bg-gradient-to-r from-indigo-500 to-purple-600`)
- **Typography**: Inter for main body text, Outfit for page headers.
- **Interactions**: Subtle border glow and scale transitions on hover.

### 4.2 Dashboard Layout (`src/app/dashboard/page.tsx`)
- Includes:
  - Total meetings header.
  - Search bar matching database titles and transcript keywords (`ILIKE` query using Supabase client).
  - Clean card grid layout rendering `MeetingCard` components.
  - State indicators for active processing jobs.

### 4.3 Meeting Details Split-Pane (`src/app/meetings/[id]/page.tsx`)
- **Left Pane (40% width)**: Scrollable, clean text container showing the generated transcript. Includes a "Copy Transcript" button.
- **Right Pane (60% width)**: Tabs interface utilizing Shadcn Tabs wrapper:
  - **Summary**: Beautifully formatted paragraphs describing meeting flow.
  - **Decisions**: Icon-based list (check circles) for clear business rules decided.
  - **Action Items**: Checkbox list displaying task, assignee badge (`@name`), and deadline badge (`📅 Date`).
  - **Risks**: Color-coded risk cards (Red for High, Yellow for Medium, Gray for Low).

---

## 5. Automated Data Retention Clean-up

To execute the 30-day retention policies (Feature 7), an automated CRON endpoint is set up.

```typescript
// src/app/api/cron-cleanup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client to bypass RLS for cleanup
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function GET(request: Request) {
  // Simple validation to ensure only cron trigger can execute this endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get expired meeting records
  const { data: expiredMeetings, error } = await supabaseAdmin
    .from('meetings')
    .select('id, storage_path')
    .lt('expires_at', new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (expiredMeetings && expiredMeetings.length > 0) {
    // Delete files from storage
    const storagePaths = expiredMeetings.map(m => m.storage_path);
    await supabaseAdmin.storage.from('recordings').remove(storagePaths);

    // Delete records from database (cascading deletes action_items, decisions, and risks)
    const idsToDelete = expiredMeetings.map(m => m.id);
    await supabaseAdmin.from('meetings').delete().in('id', idsToDelete);
  }

  return NextResponse.json({ deletedCount: expiredMeetings?.length || 0 });
}
```

---

## 6. Verification and Testing Checklist

### 6.1 Database Verification
- Run local Supabase CLI migrations or execute SQL scripts via the Supabase Dashboard.
- Verify table constraints and Row Level Security policies by attempting unauthorized queries.

### 6.2 Upload & Transcription Integration Test
- Use a mock 1-minute MP3 file.
- Perform upload: check the real-time progress bar (0 to 100%).
- Inspect storage bucket to verify file is written under correct path schema.
- Monitor console or database changes to verify transition from `processing` to `completed`.
- Validate that Action Items contain correct assignees and dates matching the test discussion.

### 6.3 30-Day Expiry Simulation
- Manually change a record's `expires_at` column in the database to a date in the past.
- Trigger the `/api/cron-cleanup` route using an authorized HTTP Request (via Insomnia, Postman, or curl).
- Confirm that the database row is deleted and the object is removed from Supabase Storage.
