export const LIVE_SYNC_STAGE_RUNTIME_TABLE = "stage_live_runtime";
export const LIVE_SYNC_SESSIONS_TABLE = "live_stream_sessions";
export const LIVE_SYNC_TRANSCRIPTS_TABLE = "live_stream_transcripts";
export const LIVE_SYNC_CLIPS_TABLE = "live_stream_hand_clips";

export const hasSupabaseLiveSyncEnabled =
  process.env.NEXT_PUBLIC_ENABLE_SUPABASE_LIVE_SYNC === "true";

export type StageLiveRuntimeRow = {
  stage_id: string;
  current_level_index: number;
  current_blind_label: string | null;
  current_match_number: number;
  current_match_started_at: string | null;
  current_match_closed: boolean;
  stage_closed: boolean;
  seat_assignments: Array<{
    seatIndex: number;
    playerId: string | null;
    playerName: string | null;
  }>;
  updated_at?: string;
};

export type LiveStreamSessionRow = {
  id?: string;
  stage_id: string;
  stage_title: string;
  stage_date_label: string | null;
  match_label: string | null;
  blind_label: string | null;
  status: "running" | "paused" | "finished";
  started_at: string;
  ended_at: string | null;
  seat_snapshot: StageLiveRuntimeRow["seat_assignments"];
  created_at?: string;
  updated_at?: string;
};

export type LiveStreamTranscriptRow = {
  id?: string;
  session_id: string;
  stage_id: string;
  title: string;
  started_at: string;
  ended_at: string;
  line_count: number;
  content: string;
  created_at?: string;
};

export type LiveStreamHandClipRow = {
  id?: string;
  session_id: string | null;
  stage_id: string | null;
  title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  match_label: string | null;
  blind_label: string | null;
  start_trigger: string | null;
  end_trigger: string | null;
  transcript_log: string[];
  storage_path: string | null;
  created_at?: string;
};
