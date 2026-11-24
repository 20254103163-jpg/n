import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Play, Square, Volume2, X } from 'lucide-react';
import { TTS_VOICES } from '../data/presets';
import { generateTtsAudioApi } from '../utils/api';

interface AudioAuditionBarProps {
  title: string;
  text: string;
  onClose: () => void;
}

export function AudioAuditionBar({ title, text, onClose }: AudioAuditionBarProps) {
  const [selectedVoice, setSelectedVoice] = useState(TTS_VOICES[0].id);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerateAndPlay = async (voiceId = selectedVoice) => {
    setIsLoading(true);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      const voiceObj = TTS_VOICES.find((v) => v.id === voiceId) ?? TTS_VOICES[0];
      const result = await generateTtsAudioApi({
        text,
        voiceName: voiceObj.id,
        style: voiceObj.style,
      });

      const binary = atob(result.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const nextUrl = URL.createObjectURL(blob);

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অডিও তৈরি করা যায়নি।');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleGenerateAndPlay(selectedVoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleDownloadWav = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${title.slice(0, 30).replace(/\s+/g, '_')}_voiceover.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Volume2 className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              ভয়েসওভার অডিশন — {title}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              কথক কণ্ঠ বদলে সরাসরি শুনে নিন ও WAV ফাইল নামিয়ে রাখুন
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="কথক কণ্ঠ নির্বাচন করুন"
            value={selectedVoice}
            onChange={(e) => {
              const nextVoice = e.target.value;
              setSelectedVoice(nextVoice);
              handleGenerateAndPlay(nextVoice);
            }}
            disabled={isLoading}
            className="text-xs bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-600"
          >
            {TTS_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isLoading || !audioUrl}
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                তৈরি হচ্ছে...
              </>
            ) : isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5" />
                থামান
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                শুনুন
              </>
            )}
          </button>

          {audioUrl && (
            <button
              type="button"
              onClick={handleDownloadWav}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              WAV
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="অডিও প্লেয়ার বন্ধ করুন"
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">{error}</p>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="mt-3 w-full h-9"
        />
      )}
    </div>
  );
}
