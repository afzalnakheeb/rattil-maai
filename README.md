# Recite With Me · رتّل معي

Live at **https://rattilmai.com**

A Quran memorization web app to the standard of Masjid al-Haram and Masjid an-Nabawi (Hafs 'an 'Asim, Madinah Mushaf).

## What works today

**Student view**
- **Today:** a daily plan with the new lesson (sabaq), recent revision (sabqi) and old revision (manzil). The daily target is half a page, one page or two pages.
- **Mushaf:** a page-by-page Madinah Mushaf with 8 reciters, including the Haramain imams. It highlights each ayah as it plays, repeats the portion 1, 3 or 5 times, and plays at 0.75× to 1.25×.
- **Recite:** recite from memory and the AI follows word by word, marking skipped, wrong and extra words. Every practice is recorded.
- **Adhkar:** morning, evening, after-prayer and sleep adhkar, with a tap counter (1/3, 2/3, 3/3) and recitation audio.
- **History:** every recording with its marks. Tap a mark to hear that moment, and share a summary.

- **Prayer:** prayer times for your city (Umm al-Qura, Dubai/Awqaf, Egypt, Karachi, ISNA, MWL and more) and a Qibla compass.
- **Duas and Ruqyah:** short and full Ruqyah, and a Hisn al-Muslim duas library. Quranic text always comes from the API.

**Teacher view (same app)**
- A class code. Students who join appear with their plan and streak.
- **Free video sessions:** the AI runs on the student's phone, the teacher sees its marks live, confirms them or adds their own, and the whole call (both voices) is recorded.
- In-person sessions on the teacher's device for students without an account.
- Review and grade a student's AI practice.
- Grade with the 4-part rubric (hifz 40, tajweed 30, makharij 20, waqf 10), add a comment, and choose pass or repeat.

**Accounts:** students and teachers sign in with Google. Progress, recordings, marks and grades sync across devices.

## How it is built

- Static ES-module web app, no build step, hosted on Vercel from `main`.
- Supabase project `rattilmai` (eu-central-1): Google Auth, Postgres with row-level security (profiles, links, user_state, sessions, reviews, calls), private `recordings` storage, Realtime.
- Video calls: WebRTC directly between the two devices, encrypted (DTLS-SRTP). Signalling and live marks go over a private Realtime channel that only the two people on the call can join. The `ice-servers` Edge Function returns STUN, plus Cloudflare TURN relays when `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` secrets are set.
- Light and dark themes share one set of colour tokens in `css/app.css`.

## Limits of this version

- **The AI check needs a supported browser.** It uses the browser's speech engine: Chrome, Edge or Safari, in Arabic. It checks words only, not tajweed. Without a speech engine, students tap the words they got wrong.

## Content sources (free)

- **Quran text:** Tanzil Uthmani (Madinah Mushaf, Hafs), via [Al Quran Cloud](https://alquran.cloud/terms-and-conditions)
- **Recitations:** [Islamic Network CDN](https://alquran.cloud/cdn). Reciters keep their copyrights.
- **Adhkar:** Hisn al-Muslim. Pending review by the academic lead.
- **Fonts:** Amiri Quran, IBM Plex Sans and IBM Plex Sans Arabic (Google Fonts, SIL Open Font License)

## Run locally

Serve the folder with any static server, for example `python3 -m http.server`. Then open `http://localhost:8000`.

Tests:
- `node tests/e2e.mjs` runs 43 browser checks with Playwright: Google sign-in, cloud sync, a real WebRTC video call between two browser windows, reviews and themes. The Quran API, audio, speech engine and cloud (`tests/fake-cloud.js`) are simulated.
- `node tests/prayer.test.mjs` checks prayer times and Qibla.
- `node tests/duas.test.mjs` checks the duas data.

## Deploy

Every push to `main` deploys to rattilmai.com through Vercel. No build step is needed.
