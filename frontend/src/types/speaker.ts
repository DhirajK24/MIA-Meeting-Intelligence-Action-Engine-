export interface Speaker {
  id: string;
  meeting_id: string;
  internal_label: string;   // "Speaker 1", "Speaker 2", etc.
  custom_name: string | null; // User-assigned name, e.g., "hitesh"
  sample_start_time: number;  // Seconds into the WAV for representative sample
  sample_end_time: number;
  segment_count: number;      // How many transcript segments belong to this speaker
  created_at: string;
}

/** Returns the best display name for a speaker */
export function speakerDisplayName(speaker: Speaker): string {
  return speaker.custom_name?.trim() || speaker.internal_label;
}

/** Resolve a raw speaker_label string to a custom display name using the speakers list */
export function resolveSpeakerLabel(
  label: string | undefined,
  speakers: Speaker[]
): string | undefined {
  if (!label) return undefined;
  const match = speakers.find((s) => s.internal_label === label);
  return match ? speakerDisplayName(match) : label;
}
