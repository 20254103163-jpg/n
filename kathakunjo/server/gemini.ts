import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY পাওয়া যায়নি। অনুগ্রহ করে Settings > Secrets প্যানেলে API Key যুক্ত করুন।'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export const TEXT_MODEL = process.env.STORY_MODEL || 'gemini-3-flash-preview';
export const FALLBACK_TEXT_MODEL = 'gemini-3.1-flash-lite';
export const TTS_MODEL = 'gemini-3.8-flash-lite-tts';

export function isTransientModelError(err: unknown): boolean {
  const errorObj = err as { status?: number; code?: number; message?: string };
  const status = errorObj?.status || errorObj?.code;
  const msg = (errorObj?.message || '').toLowerCase();
  if (status && [400, 401, 403, 404].includes(status)) {
    return false;
  }
  return (
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily')
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1100
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (!isTransientModelError(err)) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Runs a Gemini text operation with automatic retry on 503/high-demand spikes,
 * and falls back cleanly to FALLBACK_TEXT_MODEL if the primary model stays unavailable.
 */
export async function withModelFallback<T>(
  runForModel: (model: string) => Promise<T>
): Promise<T> {
  try {
    return await withRetry(() => runForModel(TEXT_MODEL), 2, 1200);
  } catch (primaryErr) {
    if (isTransientModelError(primaryErr)) {
      return await withRetry(() => runForModel(FALLBACK_TEXT_MODEL), 2, 1200);
    }
    throw primaryErr;
  }
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; code?: number; message?: string };
  const rawMessage = errorObj?.message || 'অজানা সার্ভার ত্রুটি ঘটেছে।';
  const lower = rawMessage.toLowerCase();
  const status = errorObj?.status || errorObj?.code || 500;

  if (
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied')
  ) {
    return {
      status: 403,
      message:
        'Gemini API Key সঠিক নয় বা অনুমতি নেই। অনুগ্রহ করে Settings > Secrets প্যানেল যাচাই করুন।',
    };
  }
  if (
    status === 503 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      status: 503,
      message:
        'এই মুহূর্তে AI সার্ভারে সাময়িকভাবে অতিরিক্ত চাপ রয়েছে। কয়েক সেকেন্ড পর আবার “অধ্যায়টি লিখুন” বাটনে ক্লিক করুন।',
    };
  }
  if (status === 429 || lower.includes('resource_exhausted')) {
    return {
      status: 429,
      message:
        'সাময়িকভাবে অনুরোধের সীমা পূর্ণ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    };
  }

  // Prevent raw JSON error dumps from ever reaching the Bengali UI
  if (rawMessage.trim().startsWith('{')) {
    return {
      status: status >= 400 && status < 600 ? status : 500,
      message:
        'সার্ভার থেকে উত্তর পেতে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।',
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}
