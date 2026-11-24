import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { chromium } from 'playwright-core';

/**
 * Story-to-Visual Procedural Animation Generator
 * Powered by Lanterns Over Rainbridge IK Rigging & Physics Engine
 */

const DEFAULT_STORY = {
  title: "বাইশ বছর: এক তরুণের জীবনের গল্প",
  beats: [
    {
      startSec: 0,
      endSec: 7,
      dialogue: "বাইশটা বছর পার হয়ে গেল, কিন্তু মনে হয় এক একটা রাত পার হতে অনন্তকাল লেগেছে...",
      action: "walk",          // IK walk cycle across the bridge
      mood: "Golden Dusk",    // Warm evening sky
      rain: 0.0,
      wind: 1.0,
      lanterns: false
    },
    {
      startSec: 7,
      endSec: 14,
      dialogue: "সবাই ভাবে আমি হয়তো ভালোই আছি, কিন্তু বুকের ভেতর জমে থাকা কান্নাগুলো...",
      action: "pause_sorrow",  // Pauses, head tilts down, clutching chest
      mood: "Gathering Storm", // Rain falls, ripples on water
      rain: 0.85,
      wind: 1.8,
      lanterns: false
    },
    {
      startSec: 14,
      endSec: 21,
      dialogue: "...চেপে রেখে হাসিমুখে বেঁচে থাকা যে কতটা কষ্টের—তা কাউকে কখনো বোঝাতে পারলাম না।",
      action: "reach_sky",     // Reaches toward sky as glowing lanterns ascend
      mood: "Lantern Night",   // Deep starry night with rising lanterns
      rain: 0.0,
      wind: 0.8,
      lanterns: true
    }
  ]
};

async function main() {
  const args = process.argv.slice(2);
  const storyJsonPath = args.find((_, i) => args[i-1] === '--script') || null;
  const audioPath = args.find((_, i) => args[i-1] === '--audio') || 'C:/Animation-Tools/emotional_22yo_monologue.wav';
  const outputPath = args.find((_, i) => args[i-1] === '--out') || 'C:/Animation-Tools/custom_story_animation.mp4';

  let story = DEFAULT_STORY;
  if (storyJsonPath && fs.existsSync(storyJsonPath)) {
    story = JSON.parse(fs.readFileSync(storyJsonPath, 'utf8'));
  }

  console.log(`[Story Generator] Loaded story: "${story.title}" with ${story.beats.length} beats`);

  const DURATION = story.beats[story.beats.length - 1].endSec;
  const FPS = 24;
  const TOTAL_FRAMES = Math.round(DURATION * FPS);

  console.log(`[Story Generator] Rendering ${TOTAL_FRAMES} frames @ ${FPS} fps (${DURATION}s)...`);

  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Pause live playback so we step frame-by-frame
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pauseBtn = buttons.find(b => b.textContent && b.textContent.includes('Pause'));
    if (pauseBtn) pauseBtn.click();
  });

  await page.waitForTimeout(400);

  const container = await page.$('div.relative.aspect-\\[16\\/9\\]');
  if (!container) throw new Error('Stage container not found');

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(FPS),
    '-i', '-',
    '-i', audioPath,
    '-vf', 'scale=1280:720',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outputPath
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  ffmpeg.on('error', (err) => console.error('FFmpeg error:', err));

  const start = Date.now();

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const sec = f / FPS;

    // Find current beat in the story
    const beat = story.beats.find(b => sec >= b.startSec && sec < b.endSec) || story.beats[story.beats.length - 1];

    // Scrub timeline to exact second and apply dynamic story parameters
    await page.evaluate(({ targetSec, beat }) => {
      const slider = document.querySelector('input[type="range"]');
      if (slider) {
        slider.value = String(targetSec);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { targetSec: sec, beat });

    const buffer = await container.screenshot({ type: 'jpeg', quality: 92 });
    ffmpeg.stdin.write(buffer);

    if (f % 50 === 0 || f === TOTAL_FRAMES - 1) {
      const progress = Math.round((f / TOTAL_FRAMES) * 100);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Progress: ${progress}% (frame ${f}/${TOTAL_FRAMES}) [${elapsed}s]`);
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));
  await browser.close();

  console.log(`[Story Generator] Success! Saved to: ${outputPath}`);
}

main().catch(console.error);
