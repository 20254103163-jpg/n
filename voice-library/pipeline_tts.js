import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually if exists
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k && v.length > 0 && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  }
}

loadEnv();

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in .env or environment variables.");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flags, defaultValue = '') {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]) && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return defaultValue;
}

const hasFlag = (flags) => flags.some(f => args.includes(f));

const text = getArg(['--text', '-t', '-m'], 'বাইশটা বছর পার হয়ে গেল, কিন্তু মনে হয় এক একটা রাত পার হতে অনন্তকাল লেগেছে।');
const voice = getArg(['--voice', '-v'], 'Enceladus');
const outputPath = getArg(['--out', '-o'], 'output.mp3');
const promptInstruction = getArg(['--style', '-s'], '');
const autoPlay = hasFlag(['--play', '-p']);

async function main() {
  console.log(`[Pipeline TTS] Voice: ${voice}`);
  console.log(`[Pipeline TTS] Text: "${text}"`);
  if (promptInstruction) console.log(`[Pipeline TTS] Style: "${promptInstruction}"`);

  const ai = new GoogleGenAI({ apiKey });

  const promptContent = promptInstruction 
    ? `${promptInstruction}\nText to speak:\n${text}`
    : text;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text: promptContent }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Data) {
      throw new Error("No audio data received in response from Gemini TTS API.");
    }

    const pcmBuffer = Buffer.from(base64Data, 'base64');
    const ext = path.extname(outputPath).toLowerCase();
    const tempPcm = path.join(__dirname, `temp_${Date.now()}.pcm`);

    fs.writeFileSync(tempPcm, pcmBuffer);

    const resolvedOut = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
    const outDir = path.dirname(resolvedOut);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    if (ext === '.pcm') {
      fs.copyFileSync(tempPcm, resolvedOut);
    } else {
      // Use ffmpeg to encode to mp3 or wav (24kHz 16-bit mono)
      const ffmpegCmd = `ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${tempPcm}" "${resolvedOut}"`;
      execSync(ffmpegCmd, { stdio: 'pipe' });
    }

    if (fs.existsSync(tempPcm)) fs.unlinkSync(tempPcm);

    console.log(`[Pipeline TTS] Success! Generated: ${resolvedOut}`);

    if (autoPlay && ext === '.wav') {
      console.log(`[Pipeline TTS] Playing audio...`);
      execSync(`powershell -c "(New-Object System.Media.SoundPlayer '${resolvedOut}').PlaySync()"`);
    } else if (autoPlay) {
      // For mp3, convert to wav briefly or use start
      execSync(`powershell -c "Start-Process '${resolvedOut}'"`);
    }

  } catch (err) {
    console.error("[Pipeline TTS] Error:", err.message);
    process.exit(1);
  }
}

main();
