import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "demo_output"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VOICE_LIBRARY_URL = "http://localhost:3000"
KATHAKUNJO_URL = "http://localhost:3002"
RAINBRIDGE_URL = "http://localhost:3001"
KATHAKUNJO_OUTPUT = ROOT / "kathakunjo" / "output"
FALLBACK_STORY_PATH = ROOT / "bangla-story-generator" / "output" / "story_2026-11-24T11-41-53" / "story_full.txt"


def find_latest_story() -> Path:
    if KATHAKUNJO_OUTPUT.exists():
        candidates = sorted(
            KATHAKUNJO_OUTPUT.glob("*/story_full.txt"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if candidates:
            return candidates[0]
    return FALLBACK_STORY_PATH


def http_json(url: str, payload: dict | None = None, timeout: int = 120) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}") from e


def get_wav_duration(wav_path: Path) -> float:
    try:
        with wave.open(str(wav_path), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        # Fallback via ffprobe
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(wav_path),
            ],
            text=True,
        ).strip()
        return float(out)


def main():
    print("=== [1/4] Reading Latest Bengali Story ===")
    story_path = find_latest_story()
    if not story_path.exists():
        raise FileNotFoundError(f"Story file not found: {story_path}")

    story_text = story_path.read_text(encoding="utf-8").strip()
    first_line = story_text.splitlines()[0].lstrip("#").strip() if story_text else "বাংলা গল্প"
    title = first_line[:80] or "বাংলা গল্প"
    print(f"Loaded story: {title} ({story_path})")

    print("\n=== [2/4] Generating Expressive Bengali Voiceover via VOICE LIBRARY (:3000) ===")
    vl_health = http_json(f"{VOICE_LIBRARY_URL}/api/voice-library/health", timeout=10)
    print(f"Voice Library connected: {vl_health.get('service')} (primary={vl_health.get('primaryTtsModel')})")

    # Extract clean first ~450 chars for a crisp 15-22s demo narration
    clean_lines = [
        ln.strip()
        for ln in story_text.splitlines()
        if ln.strip() and not ln.strip().startswith("#") and ln.strip() != "[মিউজিক]"
    ]
    narration_excerpt = " ".join(clean_lines[:2])[:480]
    print(f"Narration text ({len(narration_excerpt)} chars): {narration_excerpt[:100]}...")

    wav_path = OUT_DIR / "voiceover.wav"
    tts_res = http_json(
        f"{VOICE_LIBRARY_URL}/api/voice-library/tts",
        {
            "text": narration_excerpt,
            "voiceName": "Fenrir",
            "style": "Deep, heartfelt Bangladeshi storyteller narrating an emotional rural family story slowly with gentle pauses",
        },
        timeout=120,
    )
    print(f"Voice Library TTS OK: source={tts_res.get('source')}, model={tts_res.get('model')}, voice={tts_res.get('voiceName')}")
    audio_bytes = base64.b64decode(tts_res["audioBase64"])
    # Check if raw PCM or RIFF WAV
    if audio_bytes[:4] == b"RIFF":
        wav_path.write_bytes(audio_bytes)
    else:
        # Wrap 24kHz 16-bit mono PCM into WAV
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_bytes)

    audio_dur = get_wav_duration(wav_path)
    record_sec = min(max(audio_dur + 1.0, 12.0), 26.0)
    print(f"Voiceover saved: {wav_path} ({audio_dur:.2f}s) -> will record {record_sec:.1f}s of 2D animation")

    print("\n=== [3/4] Recording Live 2D Canvas Animation from Rainbridge (:3001) ===")
    webm_path = OUT_DIR / "canvas_raw.webm"
    preview_png = OUT_DIR / "demo_frame_preview.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        page.goto(RAINBRIDGE_URL, wait_until="networkidle", timeout=30000)
        page.wait_for_selector("canvas", timeout=15000)
        time.sleep(1.5)

        # Push blueprint AFTER browser SSE is connected so canvas switches live to the new story
        push_res = http_json(
            f"{KATHAKUNJO_URL}/api/pipeline/push-to-rainbridge",
            {"title": title, "fullScript": story_text, "rainbridgeUrl": RAINBRIDGE_URL},
            timeout=120,
        )
        print(f"Rainbridge Live SSE Push OK: title='{push_res.get('title')}', scenes={push_res.get('sceneCount')}")
        time.sleep(1.5)

        # Ensure playback starts from 0.0s via engine command API
        http_json(f"{RAINBRIDGE_URL}/api/engine/command", {"action": "seek", "timeSec": 0})
        http_json(f"{RAINBRIDGE_URL}/api/engine/command", {"action": "play"})
        time.sleep(0.5)

        # Capture a mid-stream preview screenshot of the canvas
        canvas = page.locator("canvas").first
        canvas.screenshot(path=str(preview_png))

        # Record the live canvas stream cleanly at 30fps inside the browser via MediaRecorder
        duration_ms = int(record_sec * 1000)
        b64_webm = page.evaluate(
            """async (durationMs) => {
                const canvas = document.querySelector('canvas');
                if (!canvas) throw new Error('Canvas not found');
                const stream = canvas.captureStream(30);
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : 'video/webm';
                const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4500000 });
                const chunks = [];
                recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
                const done = new Promise((resolve) => {
                    recorder.onstop = async () => {
                        const blob = new Blob(chunks, { type: mimeType });
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    };
                });
                recorder.start(250);
                await new Promise((r) => setTimeout(r, durationMs));
                recorder.stop();
                return await done;
            }""",
            duration_ms,
        )
        webm_path.write_bytes(base64.b64decode(b64_webm))
        browser.close()

    print(f"Canvas recorded: {webm_path} ({webm_path.stat().st_size / 1024:.1f} KB)")

    print("\n=== [4/4] Muxing 2D Animation + Bengali Voiceover into Final MP4 ===")
    mp4_path = OUT_DIR / "multi_pipe_demo.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(webm_path),
        "-i",
        str(wav_path),
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(mp4_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    size_mb = mp4_path.stat().st_size / (1024 * 1024)
    print(f"\nDONE! Final Demo Video: {mp4_path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
