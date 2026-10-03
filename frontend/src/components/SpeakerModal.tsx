'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Speaker, speakerDisplayName } from '@/types/speaker';
import {
  Users,
  Pencil,
  Check,
  X,
  PlayCircle,
  RefreshCw,
  GitMerge,
  Loader2,
  Mic,
} from 'lucide-react';

interface SpeakerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  onSpeakersUpdated?: (speakers: Speaker[]) => void;
}

const SPEAKER_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-lime-500',
];

function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

export function SpeakerModal({
  open,
  onOpenChange,
  meetingId,
  onSpeakersUpdated,
}: SpeakerModalProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState<string>('auto');
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mergeA, setMergeA] = useState<string>('');
  const [mergeB, setMergeB] = useState<string>('');
  const [merging, setMerging] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Load speakers on open
  useEffect(() => {
    if (!open || !meetingId) return;
    fetchSpeakers();
  }, [open, meetingId]);

  // Listen for diarization-complete events (e.g., triggered externally)
  useEffect(() => {
    if (!open) return;
    const unlisten = listen<string>('speakers-updated', (event) => {
      if (event.payload === meetingId) {
        fetchSpeakers();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [open, meetingId]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingLabel && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingLabel]);

  const fetchSpeakers = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const result = await invoke<Speaker[]>('get_speakers', { meetingId });
      setSpeakers(result);
      onSpeakersUpdated?.(result);
      if (result.length > 0 && !mergeA) {
        setMergeA(result[0].internal_label);
        setMergeB(result[result.length > 1 ? 1 : 0].internal_label);
      }
    } catch (err) {
      console.error('Failed to fetch speakers:', err);
    } finally {
      setLoading(false);
    }
  }, [meetingId, onSpeakersUpdated, mergeA]);

  const handleRerun = async () => {
    setRerunning(true);
    try {
      const parsedCount =
        numSpeakers === 'auto' ? null : parseInt(numSpeakers, 10);
      const result = await invoke<Speaker[]>('re_run_diarization', {
        meetingId,
        numSpeakers: parsedCount,
      });
      setSpeakers(result);
      onSpeakersUpdated?.(result);
    } catch (err) {
      console.error('Diarization failed:', err);
    } finally {
      setRerunning(false);
    }
  };

  const startEdit = (speaker: Speaker) => {
    setEditingLabel(speaker.internal_label);
    setEditValue(speaker.custom_name || speaker.internal_label);
  };

  const cancelEdit = () => {
    setEditingLabel(null);
    setEditValue('');
  };

  const commitEdit = async (speaker: Speaker) => {
    const newName = editValue.trim();
    if (!newName || newName === speaker.internal_label) {
      cancelEdit();
      return;
    }
    try {
      await invoke('update_speaker_name', {
        meetingId,
        internalLabel: speaker.internal_label,
        customName: newName,
      });
      setSpeakers((prev) =>
        prev.map((s) =>
          s.internal_label === speaker.internal_label
            ? { ...s, custom_name: newName }
            : s
        )
      );
      onSpeakersUpdated?.(
        speakers.map((s) =>
          s.internal_label === speaker.internal_label
            ? { ...s, custom_name: newName }
            : s
        )
      );
    } catch (err) {
      console.error('Failed to rename speaker:', err);
    } finally {
      cancelEdit();
    }
  };

  const handlePlaySample = async (speaker: Speaker) => {
    if (playingLabel === speaker.internal_label) {
      // Already playing — do nothing (let it finish)
      return;
    }
    setPlayingLabel(speaker.internal_label);
    try {
      const wavBytes = await invoke<number[]>('play_speaker_sample', {
        meetingId,
        internalLabel: speaker.internal_label,
      });

      // Decode and play via Web Audio API
      const buffer = new Uint8Array(wavBytes).buffer;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const decoded = await ctx.decodeAudioData(buffer);
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => setPlayingLabel(null);
    } catch (err) {
      console.error('Failed to play sample:', err);
      setPlayingLabel(null);
    }
  };

  const handleMerge = async () => {
    if (!mergeA || !mergeB || mergeA === mergeB) return;
    setMerging(true);
    try {
      const result = await invoke<Speaker[]>('merge_speakers', {
        meetingId,
        labelA: mergeA,
        labelB: mergeB,
      });
      setSpeakers(result);
      onSpeakersUpdated?.(result);
      // Reset merge selections
      setMergeA(result[0]?.internal_label ?? '');
      setMergeB(result[result.length > 1 ? 1 : 0]?.internal_label ?? '');
    } catch (err) {
      console.error('Failed to merge speakers:', err);
    } finally {
      setMerging(false);
    }
  };

  const noneFound = !loading && speakers.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader className="border-b border-zinc-800 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="w-5 h-5 text-blue-400" />
            Speaker Identification
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="identify" className="mt-2">
          <TabsList className="bg-zinc-900 border border-zinc-800 w-full">
            <TabsTrigger value="identify" className="flex-1 data-[state=active]:bg-zinc-800">
              Identify
            </TabsTrigger>
            <TabsTrigger value="merge" className="flex-1 data-[state=active]:bg-zinc-800">
              Merge
            </TabsTrigger>
          </TabsList>

          {/* ─── Identify Tab ─── */}
          <TabsContent value="identify" className="mt-4 space-y-4">
            {/* Controls Row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-zinc-400 whitespace-nowrap">Participants:</span>
                <Select value={numSpeakers} onValueChange={setNumSpeakers}>
                  <SelectTrigger className="w-28 h-8 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    <SelectItem value="auto">Auto</SelectItem>
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleRerun}
                disabled={rerunning}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
              >
                {rerunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {rerunning ? 'Running…' : 'Re-run'}
              </Button>
            </div>

            {/* Speaker List */}
            <div className="min-h-[160px] max-h-[50vh] overflow-y-auto pr-2">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading speakers…
                </div>
              ) : noneFound ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
                  <Mic className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No speakers identified yet.</p>
                  <p className="text-xs text-zinc-600">Click Re-run to start diarization.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {speakers.map((speaker, idx) => (
                    <div
                      key={speaker.internal_label}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full ${getSpeakerColor(idx)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
                      >
                        {speakerDisplayName(speaker).charAt(0).toUpperCase()}
                      </div>

                      {/* Name / Edit */}
                      <div className="flex-1 min-w-0">
                        {editingLabel === speaker.internal_label ? (
                          <div className="flex items-center gap-1">
                            <Input
                              ref={editInputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(speaker);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="h-7 py-0 text-sm bg-zinc-800 border-zinc-600 text-zinc-100"
                            />
                            <button
                              onClick={() => commitEdit(speaker)}
                              className="text-emerald-400 hover:text-emerald-300 p-1"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-zinc-500 hover:text-zinc-300 p-1"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-sm text-zinc-100 truncate">
                              {speakerDisplayName(speaker)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {speaker.segment_count} segment{speaker.segment_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {editingLabel !== speaker.internal_label && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEdit(speaker)}
                            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            title="Rename speaker"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handlePlaySample(speaker)}
                            disabled={playingLabel === speaker.internal_label}
                            className="p-1.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            title="Listen to sample"
                          >
                            {playingLabel === speaker.internal_label ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            ) : (
                              <PlayCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Done
              </Button>
            </div>
          </TabsContent>

          {/* ─── Merge Tab ─── */}
          <TabsContent value="merge" className="mt-4 space-y-4">
            <p className="text-sm text-zinc-400">
              Select two speakers that are the same person. The second speaker
              will be absorbed into the first.
            </p>

            {speakers.length < 2 ? (
              <div className="flex items-center justify-center h-24 text-zinc-600 text-sm">
                At least 2 speakers needed to merge.
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Select value={mergeA} onValueChange={setMergeA}>
                  <SelectTrigger className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue placeholder="Speaker A" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    {speakers.map((s) => (
                      <SelectItem key={s.internal_label} value={s.internal_label}>
                        {speakerDisplayName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <GitMerge className="w-5 h-5 text-zinc-500 flex-shrink-0" />

                <Select value={mergeB} onValueChange={setMergeB}>
                  <SelectTrigger className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 text-sm">
                    <SelectValue placeholder="Speaker B" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                    {speakers.map((s) => (
                      <SelectItem
                        key={s.internal_label}
                        value={s.internal_label}
                        disabled={s.internal_label === mergeA}
                      >
                        {speakerDisplayName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMerge}
                disabled={merging || speakers.length < 2 || mergeA === mergeB}
                className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
              >
                {merging ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitMerge className="w-3.5 h-3.5" />
                )}
                {merging ? 'Merging…' : 'Merge'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
