# Functional Requirements Document: Real-Time Chunked Transcription

This document outlines the functional requirements, system architecture, data models, and implementation steps for introducing real-time chunk-by-chunk transcription and processing in the AI Meeting Notes application.

---

## 1. Overview and Objectives

Currently, users uploading meeting recordings must wait for the entire file to upload and transcribe before seeing any content. For longer files, this leads to long loading states and poor user experience.

The goal of this feature is to process uploads in parallel, 30-second segments, updating the transcription UI in real-time as each segment finishes, while delaying the summary and action items until the full text is assembled.

### Success Criteria
- **Time to First Chunk**: Real-time transcript text should start appearing in the UI within 15 seconds after the video upload finishes.
- **Accuracy**: Aggregated transcript must remain fully coherent, matching or exceeding the single-pass processing accuracy.
- **Zero Layout Shifts**: UI updates must render smoothly without resetting scroll positions or causing jumping elements.

---

## 2. Target Audience
Product Managers, developers, and team leads who need quick access to meeting transcripts and summaries, expecting instant visual feedback during processing.

---

## 3. Competitive Landscape and Differentiation
Popular tools like Otter.ai or Zoom AI Companion transcribe streams in real-time. By leveraging Supabase Realtime and Gemini's Files API, this application will match that level of responsiveness at a fraction of the cost, maintaining high-security posture via full RLS coverage on all intermediate data chunks.

---

## 4. Core Features and Requirements

### TASK-2: Database Schema for Chunks
- Create a new database table `public.transcript_chunks` to store 30-second segments of a meeting transcript.
- Enable Row-Level Security (RLS) on `public.transcript_chunks` to restrict access to authenticated users owning the associated meeting.
- Enable Supabase Realtime replication on the `public.transcript_chunks` table to allow WebSocket streaming.

### TASK-3: Server-Side Audio Chunking Utility
- Integrate `ffmpeg-static` in the Next.js API environment to perform server-side extraction and chunking.
- Write a helper utility that reads the downloaded media file, extracts its audio track, and slices it into sequential 30-second files (e.g. `chunk_0.wav`, `chunk_1.wav`, etc.) in a temporary folder.

### TASK-4: Parallel Chunk Transcription Pipeline
- Implement an asynchronous worker pipeline in `src/app/api/process/route.ts` that:
  - Identifies the total number of chunks.
  - Uploads chunks to the Gemini Files API.
  - Polls each chunk until it is `ACTIVE`.
  - Sends each active chunk to Gemini for transcription in parallel or sequence, limiting concurrent calls to prevent rate limits.
  - Inserts the resulting text into `public.transcript_chunks` with its `chunk_index`, `start_time`, and `end_time`.

### TASK-5: Supabase Realtime Client listener
- Implement a realtime WebSocket listener on the frontend dashboard and meeting details page.
- Listen for `INSERT` events on the `transcript_chunks` table filtered by the current `meeting_id`.

### TASK-6: Real-Time Segment Rendering UI
- Update `src/app/meetings/[id]/page.tsx` to display chunks in real-time as they arrive from the WebSocket subscription.
- Ensure segments are stitched together in order of `chunk_index`, displaying timestamps (e.g., `[00:00 - 00:30]`) next to each segment.

### TASK-7: Final Insights Generation
- Once all chunks are marked as complete, trigger a final Gemini API call.
- Provide the full joined transcript to Gemini to extract:
  - Meeting Summary
  - Key Decisions
  - Action Items
  - Risks
- Update the main meeting record in `public.meetings` to set `status` to `completed` and write the summary.

---

## 5. Key User Flows

### Video Upload and Processing Flow
1. User uploads a video and clicks **Upload and Analyze**.
2. File uploads to Supabase storage.
3. User is redirected to the dashboard, where the meeting card shows the status **Downloading...**.
4. The backend splits the file. Once splitting is done, the meeting status updates to **Transcribing...**.
5. The UI meeting card updates dynamically. When the user clicks the meeting, they can watch the **Meeting Transcript** pane populate segment-by-segment in real-time with timestamps.
6. Once the final chunk is saved, the status updates to **Saving Insights...** while Gemini aggregates the full transcript.
7. Processing completes. The status changes to **Completed**, and the tabs for **Summary**, **Decisions**, **Actions**, and **Risks** become active and populate.

---

## 6. Technical Stack Recommendations
- **Backend Splitting**: `ffmpeg-static` (static binaries for media slicing) + `child_process` in Next.js Server Actions or Route Handlers.
- **Client Synchronization**: `@supabase/supabase-js` Realtime client (WebSockets channel).
- **Processing Engine**: `@google/genai` SDK using `gemini-2.5-flash` model.

---

## 7. Prerequisites and Access

### Database Access
- **Status**: Authenticated connectivity verified.
- **Target Tables**:
  - `public.meetings`
  - `public.transcript_chunks` [NEW]

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase endpoint; written in `.env.local`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Client authorization; written in `.env.local`.
- `SUPABASE_SECRET_KEY`: Service role bypass; written in `.env.local`.
- `GEMINI_API_KEY`: API dashboard token; written in `.env.local`.

---

## 8. Conceptual Data Model

### `public.transcript_chunks` [NEW]
| Column Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | Primary Key, Default: `gen_random_uuid()` | Unique identifier |
| `meeting_id` | `uuid` | Foreign Key -> `meetings.id` ON DELETE CASCADE | Associated meeting reference |
| `chunk_index` | `integer` | NOT NULL | Sequence index of the segment |
| `start_time` | `numeric` | NOT NULL | Start time in seconds |
| `end_time` | `numeric` | NOT NULL | End time in seconds |
| `text` | `text` | NOT NULL | The transcription text of this segment |
| `status` | `varchar(50)` | Default: `'processing'` | `'processing'`, `'completed'`, `'failed'` |
| `created_at` | `timestamptz`| Default: `now()` | Timestamp |

---

## 9. Security Considerations
- **Row-Level Security (RLS)**:
  - All users must be `authenticated` to view transcript chunks.
  - The `USING` clause on `transcript_chunks` must verify that the related meeting belongs to the user:
    ```sql
    CREATE POLICY "Allow users to read chunks of their meetings"
    ON public.transcript_chunks
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.meetings
        WHERE meetings.id = transcript_chunks.meeting_id AND meetings.user_id = auth.uid()
      )
    );
    ```
- **Service Security**: `ffmpeg-static` temporary directories must be deleted immediately after execution to prevent local storage leakage.

---

## 10. Assumptions and Dependencies
- **Server Capacity**: The execution host running Next.js has sufficient memory and CPU to handle `ffmpeg` audio slicing operations.
- **Rate Limits**: The Gemini API keys support concurrent requests for transcribing multiple 30-second audio files in parallel. If rate limits are encountered, sequential processing will be implemented.
