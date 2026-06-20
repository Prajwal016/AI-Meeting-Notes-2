# Tech Stack Documentation

## AI Meeting Intelligence Assistant – Phase 2

This document details the selected technologies, libraries, and architecture choices for the Phase 2 implementation of the AI Meeting Intelligence Assistant.

---

## 1. Core Stack Summary

| Technology | Layer | Purpose |
| :--- | :--- | :--- |
| **Next.js (App Router)** | Web Framework / Routing | Server-side rendering, client-side views, and serverless API endpoints. |
| **TypeScript** | Language | High type safety, modular structures, and cleaner contract specifications. |
| **Tailwind CSS** | Styling / Theme | Utility-first CSS for implementing the dark, premium gradient aesthetic. |
| **Shadcn UI** | Component UI Library | Reusable, accessible component primitives (Buttons, Cards, Dialogs, Tabs, Progress). |
| **Supabase PostgreSQL** | Database Layer | Relational storage for user metadata, transcription text, and structured intelligence. |
| **Supabase Storage** | File / Object Hosting | Secure, private storage for MP4, MOV, MP3, and WAV media files. |
| **Supabase Auth** | Identity Management | Direct client-side user sessions, login, and registration. |
| **OpenAI Whisper (`whisper-1`)**| Speech-To-Text AI | Conversion of raw audio streams into high-accuracy plaintext transcription. |
| **OpenAI Chat API (GPT-4o/mini)**| Generative LLM Analysis | Parsing unstructured transcripts into structured meeting notes, tasks, decisions, and risks. |
| **Vercel** | Deployment | Continuous integration, automatic edge deployment, and hosting of serverless functions. |

---

## 2. Component Specifications

### 2.1 Web Client & Frontend
- **Framework**: Next.js 14+ (App Router).
- **Styling**: Vanilla CSS variable tokens mapped with Tailwind utility classes.
- **Components**: Radix UI primitives styled via `shadcn/ui` wrappers.
- **Interactions**: Framer Motion or custom CSS transitions for premium hover indicators, card scaling, and progressive file upload loaders.
- **State Management**: React state hooks coupled with Supabase user auth context providers.

### 2.2 Database & Data Model
- **Engine**: PostgreSQL hosted on Supabase.
- **Tables**:
  - `public.meetings`: Stores core upload history, transcript content, status tags, and retention metadata.
  - `public.action_items`: Houses tasks, assignees, deadlines, and completion flags.
  - `public.decisions`: Houses isolated meeting logs representing alignments.
  - `public.risks`: Houses severity-tagged business blockages and dependencies.
- **Access Controls**: PostgreSQL Row Level Security (RLS) restricts access to all tables so that users can only select/modify records that contain their own active `user_id`.

### 2.3 Storage & File Management
- **Bucket**: `recordings` (Private).
- **Allowed Formats**: `.mp4`, `.mov`, `.mp3`, `.wav`.
- **Upload Pipeline**: Direct browser-to-Supabase upload via client pre-signed URLs to bypass serverless payload limits.
- **Retention**: Strictly 30 days. Handled via automated daily trigger querying `expires_at` column.

### 2.4 Artificial Intelligence & LLM Pipeline
- **Transcription Service**: OpenAI Whisper API. Audio files are isolated, checked, and transcribed in single runs (restricted to 25MB file boundaries for API requests, chunked if necessary).
- **Parsing Service**: OpenAI Chat Completions API with `response_format: { type: "json_object" }` enforced.
- **Target LLM Model**: `gpt-4o-mini` (primary for low latency and high quality/cost ratio) or `gpt-4o` (for complex multi-speaker jargon).

---

## 3. Configuration & Environment Variables

The application requires the following environment configurations to connect frontend and backend components securely:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-secret-service-role-key" # Keep secret! Exclude from client.

# OpenAI Integration
OPENAI_API_KEY="sk-proj-your-openai-secret-key" # Keep secret! Exclude from client.

# Automated Cron Jobs
CRON_SECRET="your-pre-shared-cron-cleanup-passkey" # Secures automated daily file cleanup.
```
