# Voice Library - Multi-Pipeline Integration Guide

এই ফোল্ডারে সম্পূর্ণ **Voice Library** সেটআপ করা হয়েছে যা আপনি Web UI হিসেবে এবং আপনার যে কোনো অটোমেটেড পাইপলাইনে (যেমন `Awesome-Story-Generation`, `storyboarder` বা নিজস্ব স্ক্রিপ্ট) ব্যবহার করতে পারবেন।

---

## ১. সরাসরি Web UI চালু করার নিয়ম
`start-app.bat` ফাইলে ডাবল ক্লিক করুন।
- এটি স্বয়ংক্রিয়ভাবে লোকাল সার্ভার চালু করবে: `http://localhost:3000`
- ব্রাউজারে ৩D ক্যারোসেল ও গ্রিড ভিউতে সব ভয়েস প্রিভিউ এবং টেস্ট করতে পারবেন।

---

## ২. পাইপলাইনে কমান্ড লাইনের (CLI) মাধ্যমে ব্যবহার

### ক. Node.js দিয়ে সরাসরি রান:
```bash
node pipeline_tts.js --text "আপনার বাংলা সংলাপ এখানে দিন" --voice "Enceladus" --out "speech.mp3"
```
#### অপশনসমূহ:
- `--text` বা `-t`: টেক্সট / সংলাপ (বাংলা/ইংরেজি যেকোনো ভাষা)।
- `--voice` বা `-v`: ভয়েসের নাম (ডিফল্ট: `Enceladus`)।
- `--out` বা `-o`: আউটপুট ফাইলের পাথ (`.mp3` বা `.wav`)।
- `--style` বা `-s`: ইমোশন বা উচ্চারণ নির্দেশিকা (যেমন: `"Speak in a very sad, emotional tone"` বা আঞ্চলিক ভাষার জন্য `"বরিশালের আঞ্চলিক ভাষায় বলো"`).
- `--play` বা `-p`: জেনারেট শেষে স্পিকারে বাজিয়ে শোনাবে।

---

### খ. Python দিয়ে সরাসরি রান (বা অন্য পাইথন স্ক্রিপ্ট থেকে কল):

#### টার্মিনাল কমান্ড:
```bash
python pipeline_tts.py --text "বুকের ভেতর জমে থাকা কান্নাগুলো কাউকে বোঝাতে পারলাম না।" --voice "Enceladus" --out "voice.wav"
```

#### পাইথন কোডের ভেতরে ইমপোর্ট করে ব্যবহার:
```python
import sys
from pathlib import Path

# voice-library পাথ অ্যাড করুন
VOICE_LIB_DIR = Path(r"C:\Users\mdhou\Desktop\multi_pipe\voice-library")
sys.path.append(str(VOICE_LIB_DIR))

from pipeline_tts import generate_voice

audio_file = generate_voice(
    text="আজ অনেক দিন পর আকাশটা এত মেঘলা লাগছে...",
    voice="Enceladus",
    out_path="output_audio.mp3",
    style="Emotional, melancholic tone"
)

print(f"Generated audio at: {audio_file}")
```

---

## ৩. প্রধান ভয়েস তালিকা (Gemini Flash Voice Models)

| Voice Name | Gender / Vibe | বিবরণ ও উপযুক্ত বয়স |
|---|---|---|
| **Enceladus** | Male (Youthful / Soft) | ১৮-২৪ বছর বয়সী আবেগপ্রবণ, দুঃখী ও গভীর মনোলগের জন্য সেরা। |
| **Puck** | Male (Energetic / Clear) | তরুণ, চঞ্চল, দ্রুত কথপোকথন ও অ্যানিমেশনের জন্য উপযুক্ত। |
| **Charon** | Male (Deep / Mature) | গম্ভীর, ভারিক্কি, প্রবীণ বা বয়স্ক ব্যক্তির কণ্ঠ। |
| **Fenrir** | Male (Rough / Powerful) | আগ্রাসী, রাগী বা যোদ্ধা চরিত্রের জন্য। |
| **Kore** | Female (Warm / Gentle) | স্নিগ্ধ, মায়াবী ও ইমোশনাল নারী কণ্ঠ। |
| **Aoede** | Female (Narrator) | গল্পপাঠ ও মার্জিত বাচনভঙ্গির নারী কণ্ঠ। |
| **Leda** | Female (Mature) | পরিণত ও আত্মবিশ্বাসী নারী কণ্ঠ। |

---

## ৪. কনফিগারেশন
- API কি `.env` ফাইলে সংরক্ষিত রয়েছে। কোনো অতিরিক্ত কনফিগারেশন প্রয়োজন নেই।
- আউটপুট অডিও স্বয়ংক্রিয়ভাবে **FFmpeg** এর মাধ্যমে 24000Hz স্টুডিও কোয়ালিটির WAV ও MP3 তে কনভার্ট হয়ে যায়।
