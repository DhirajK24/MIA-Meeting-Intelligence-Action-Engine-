-- Speaker diarization support
-- meeting_speakers: stores identified speakers and user-assigned names
CREATE TABLE IF NOT EXISTS meeting_speakers (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    internal_label TEXT NOT NULL,
    custom_name TEXT,
    sample_start_time REAL NOT NULL,
    sample_end_time REAL NOT NULL,
    segment_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE(meeting_id, internal_label)
);

-- Add speaker_label column to transcripts to link each segment to a diarized speaker
-- This is separate from the existing 'speaker' column (which stores 'mic'/'system' source)
ALTER TABLE transcripts ADD COLUMN speaker_label TEXT;
