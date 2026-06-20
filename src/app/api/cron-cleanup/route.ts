import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // 1. Auth check with CRON_SECRET header or query param
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const clientSecret = authHeader ? authHeader.replace('Bearer ', '') : searchParams.get('secret');

    if (!clientSecret || clientSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Initialize admin client (bypassing RLS for system clean-up)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error('Missing admin client environment variables');
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // 3. Find meeting rows where expires_at <= current timestamp
    const nowISO = new Date().toISOString();
    const { data: expiredMeetings, error: fetchError } = await supabaseAdmin
      .from('meetings')
      .select('id, storage_path')
      .lte('expires_at', nowISO);

    if (fetchError) {
      throw new Error(`Failed to fetch expired meetings: ${fetchError.message}`);
    }

    if (!expiredMeetings || expiredMeetings.length === 0) {
      return NextResponse.json({ success: true, message: 'No expired meetings found.', count: 0 });
    }

    // 4. Delete the files from Supabase Storage bucket
    const filePaths = expiredMeetings.map((m) => m.storage_path);
    const { error: storageError } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_BUCKET || 'recordings')
      .remove(filePaths);

    if (storageError) {
      console.error(`Storage deletion warning/error: ${storageError.message}`);
    }

    // 5. Delete meeting rows from the database (on cascade will delete child action_items, decisions, risks)
    const meetingIds = expiredMeetings.map((m) => m.id);
    const { error: deleteError } = await supabaseAdmin
      .from('meetings')
      .delete()
      .in('id', meetingIds);

    if (deleteError) {
      throw new Error(`Failed to delete expired meetings in database: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${expiredMeetings.length} meetings.`,
      count: expiredMeetings.length,
    });
  } catch (err: any) {
    console.error('Cron clean-up error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
