import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { gemini } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  let meetingId = '';
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      meetingId: reqMeetingId,
      storagePath,
      title,
      fileName,
      fileType,
      fileSize,
    } = await request.json();

    meetingId = reqMeetingId;

    if (!meetingId || !storagePath || !title || !fileName) {
      return NextResponse.json(
        { error: 'meetingId, storagePath, title, and fileName are required' },
        { status: 400 }
      );
    }

    // 1. Create a database record with "downloading" status
    const { error: insertError } = await supabase.from('meetings').insert({
      id: meetingId,
      user_id: user.id,
      title,
      file_name: fileName,
      storage_path: storagePath,
      file_type: fileType || 'unknown',
      file_size: fileSize || 0,
      status: 'downloading',
    });

    if (insertError) {
      throw new Error(`Database initial insert failed: ${insertError.message}`);
    }

    // 2. Download the uploaded file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET || 'recordings')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download recording from storage: ${downloadError?.message || 'Empty file data'}`);
    }

    // Save temporary file locally inside the workspace's tmp folder
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${meetingId}-${fileName}`);
    const arrayBuffer = await fileData.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

    // Update status to 'transcribing'
    await supabase.from('meetings').update({ status: 'transcribing' }).eq('id', meetingId);

    // 3. Upload file to Gemini Files API and call Gemini for transcript & intelligence
    let intelligence: any = {};
    let uploadResult: any = null;
    try {
      const mimeType = fileType || 'audio/mp3';
      uploadResult = await gemini.files.upload({
        file: tempFilePath,
        config: {
          mimeType,
        },
      });

      // Wait for the file to become ACTIVE
      let fileState = await gemini.files.get({ name: uploadResult.name });
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (5s * 60)
      while (fileState.state?.toString() === 'PROCESSING' && attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        fileState = await gemini.files.get({ name: uploadResult.name });
      }

      if (fileState.state?.toString() !== 'ACTIVE') {
        throw new Error(`File processing failed: state is ${fileState.state?.toString() || 'unknown'}`);
      }

      const responseSchema = {
        type: 'OBJECT',
        properties: {
          transcript: {
            type: 'STRING',
            description: 'The verbatim, complete speech-to-text transcription of the audio file. Do not summarize or skip anything.'
          },
          summary: {
            type: 'STRING',
            description: 'A comprehensive summary of the meeting, mapping out the main objectives, discussion flow, and key highlights.'
          },
          decisions: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Key alignments or agreements reached.'
          },
          actionItems: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                description: { type: 'STRING' },
                assignee: { type: 'STRING', nullable: true },
                deadline: { type: 'STRING', nullable: true, description: 'Expected format is YYYY-MM-DD' }
              },
              required: ['description']
            },
            description: 'Action items/tasks identified during the meeting.'
          },
          risks: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                description: { type: 'STRING' },
                severity: { type: 'STRING', enum: ['low', 'medium', 'high'] }
              },
              required: ['description', 'severity']
            },
            description: 'Project risks identified.'
          }
        },
        required: ['transcript', 'summary', 'decisions', 'actionItems', 'risks']
      };

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            fileData: {
              fileUri: uploadResult.uri,
              mimeType: uploadResult.mimeType,
            },
          },
          {
            text: 'You are a professional business analyst. Analyze this meeting recording. Verbatim transcribe the discussion and extract the meeting summary, decisions, action items, and risks.'
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      });

      const responseText = response.text || '{}';
      intelligence = JSON.parse(responseText);
    } finally {
      // Always cleanup local temp files immediately to save space
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      // Cleanup uploaded file from Gemini storage
      if (uploadResult && uploadResult.name) {
        try {
          await gemini.files.delete({ name: uploadResult.name });
        } catch (deleteError) {
          console.error('Failed to delete file from Gemini storage:', deleteError);
        }
      }
    }

    const transcriptText = intelligence.transcript || '';
    if (!transcriptText || transcriptText.trim() === '') {
      throw new Error('Gemini audio processing generated an empty transcript.');
    }

    // Update status to 'saving' before bulk inserting related lists
    await supabase.from('meetings').update({ status: 'saving' }).eq('id', meetingId);

    // 5. Bulk insert Decisions
    if (intelligence.decisions && intelligence.decisions.length > 0) {
      const decisionsData = intelligence.decisions.map((desc: string) => ({
        meeting_id: meetingId,
        description: desc,
      }));
      await supabase.from('decisions').insert(decisionsData);
    }

    // 6. Bulk insert Action Items
    if (intelligence.actionItems && intelligence.actionItems.length > 0) {
      const actionItemsData = intelligence.actionItems.map((item: any) => ({
        meeting_id: meetingId,
        description: item.description,
        assignee: item.assignee || null,
        deadline: item.deadline || null,
        is_completed: false,
      }));
      await supabase.from('action_items').insert(actionItemsData);
    }

    // 7. Bulk insert Risks
    if (intelligence.risks && intelligence.risks.length > 0) {
      const risksData = intelligence.risks.map((risk: any) => ({
        meeting_id: meetingId,
        description: risk.description,
        severity: risk.severity || 'medium',
      }));
      await supabase.from('risks').insert(risksData);
    }

    // 8. Update the meeting record with transcript, summary, and status "completed"
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: transcriptText,
        summary: intelligence.summary || 'No summary generated.',
        status: 'completed',
      })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Failed to update final meeting details to completed: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, meetingId });
  } catch (err: any) {
    console.error('Process route error:', err);

    // Attempt to update status to failed in DB
    if (meetingId) {
      try {
        const supabase = await createServerClient();
        await supabase
          .from('meetings')
          .update({ status: 'failed' })
          .eq('id', meetingId);
      } catch (dbErr) {
        console.error('Failed to update error status in DB:', dbErr);
      }
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
