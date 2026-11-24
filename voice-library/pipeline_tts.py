import os
import sys
import argparse
import subprocess
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent

def load_env():
    env_file = CURRENT_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip()

load_env()

def generate_voice(text, voice="Enceladus", out_path="output.mp3", style=None):
    """
    Calls the node pipeline_tts.js runner.
    """
    node_script = CURRENT_DIR / "pipeline_tts.js"
    cmd = ["node", str(node_script), "--text", text, "--voice", voice, "--out", str(out_path)]
    if style:
        cmd.extend(["--style", style])
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(CURRENT_DIR))
    if result.returncode != 0:
        raise RuntimeError(f"TTS generation failed: {result.stderr or result.stdout}")
    print(result.stdout)
    return str(out_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Multi Pipeline TTS Generator (Gemini Flash Voice)")
    parser.add_argument("--text", "-t", required=True, help="Text to convert to speech (supports Bangla/English)")
    parser.add_argument("--voice", "-v", default="Enceladus", help="Voice name (e.g. Enceladus, Puck, Charon, Kore, Fenrir, Aoede)")
    parser.add_argument("--out", "-o", default="output.mp3", help="Output path (.mp3 or .wav)")
    parser.add_argument("--style", "-s", default="", help="Optional style instruction (e.g. 'Emotional sorrowful tone')")
    parser.add_argument("--play", "-p", action="store_true", help="Play audio immediately")

    args = parser.parse_args()
    out = generate_voice(args.text, args.voice, args.out, args.style)
    if args.play:
        os.system(f'powershell -c "Start-Process \'{out}\'"')
