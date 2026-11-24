import { useState } from 'react';
import { ArrowRight, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { SAMPLE_RUMA_TRANSCRIPT } from '../data/presets';
import type { StoryDnaProfile } from '../types/story';
import { analyzeDnaApi } from '../utils/api';

interface DnaAnalyzerProps {
  onApplyDnaToLab: (dna: StoryDnaProfile) => void;
  onSaveDna: (dna: StoryDnaProfile) => void;
}

export function DnaAnalyzer({ onApplyDnaToLab, onSaveDna }: DnaAnalyzerProps) {
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StoryDnaProfile | null>(null);

  const handleAnalyze = async () => {
    if (transcript.trim().length < 60) {
      setError('বিশ্লেষণের জন্য অন্তত কয়েক লাইনের একটি বাংলা গল্প পেস্ট করুন।');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const dna = await analyzeDnaApi(transcript);
      setResult(dna);
      onSaveDna(dna);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'গল্প বিশ্লেষণ করা যায়নি।'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
      <div className="space-y-2 max-w-3xl">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          রেফারেন্স ট্রান্সক্রিপ্ট রিভার্স-ইঞ্জিনিয়ারিং
        </p>
        <h1 className="font-serif text-3xl font-bold text-zinc-950 dark:text-zinc-50">
          ভাইরাল গল্পের ডিএনএ বিশ্লেষক
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          যেকোনো জনপ্রিয় বাংলা অডিও-গল্প বা ইউটিউব ট্রান্সক্রিপ্ট এখানে পেস্ট করুন। ইঞ্জিন তার হুক ফর্মুলা, কথ্য ভাষার ছন্দ, প্রতীকী বস্তু আর আবেগের গতিপথ বের করে দেবে—যেন সেই একই প্রাণশক্তি দিয়ে নতুন মৌলিক গল্প বানাতে পারেন।
        </p>
      </div>

      {/* Input Card */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="dna-transcript"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            গল্পের ট্রান্সক্রিপ্ট বা অংশবিশেষ
          </label>
          <button
            type="button"
            onClick={() => {
              setTranscript(SAMPLE_RUMA_TRANSCRIPT);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            রুমার গল্প লোড করুন (“আমাগো দরজা এখন সারারাত খোলা থাকে”)
          </button>
        </div>

        <textarea
          id="dna-transcript"
          rows={9}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="এখানে যেকোনো বাংলা গল্প বা ইউটিউব স্ক্রিপ্ট পেস্ট করুন..."
          className="w-full p-4 font-manuscript text-sm sm:text-base bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
        />

        {error && (
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {transcript.trim() ? `${transcript.trim().split(/\s+/).length} শব্দ` : '০ শব্দ'}
          </span>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                গল্পের ডিএনএ বের হচ্ছে...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                ডিএনএ বিশ্লেষণ করুন
              </>
            )}
          </button>
        </div>
      </section>

      {/* Analysis Result */}
      {result && (
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                বিশ্লেষিত গল্প-কাঠামো
              </p>
              <h2 className="font-serif text-2xl font-bold text-zinc-950 dark:text-zinc-50 mt-1">
                {result.sourceTitle}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onApplyDnaToLab(result)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              এই ফর্মুলায় নতুন টপিক বানান
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ০১. প্রথম ২০ সেকেন্ডের হুক কৌশল
              </h3>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {result.hookFormula}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ০২. কথ্য ভাষা ও কণ্ঠস্বরের ছন্দ
              </h3>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {result.dialectFingerprint}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ০৩. প্রতীকী বস্তু ও অনুষঙ্গ
              </h3>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {result.symbolicMotifs.map((m, i) => (
                  <li key={i} className="leading-relaxed">
                    — {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ০৪. অশ্রু ও সহানুভূতির মূল মুহূর্ত
              </h3>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {result.empathyTriggers.map((m, i) => (
                  <li key={i} className="leading-relaxed">
                    — {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ০৫. সূক্ষ্ম ঘরোয়া ডিটেইল
              </h3>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {result.sensoryDetailsUsed.map((m, i) => (
                  <li key={i} className="leading-relaxed">
                    — {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              ০৬. শ্রোতা ধরে রাখার ধাপসমূহ (Pacing Curve)
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {result.pacingArchitecture.map((step, i) => (
                <li key={i} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
