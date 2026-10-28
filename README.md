# Recite With Me · رتّل معي

A Quran memorization web app to the standard of Masjid al-Haram and Masjid an-Nabawi (Hafs 'an 'Asim, Madinah Mushaf).

## What works today

**Student view**
- **Today:** a daily plan with the new lesson (sabaq), recent revision (sabqi) and old revision (manzil). The daily target is half a page, one page or two pages.
- **Mushaf:** a page-by-page Madinah Mushaf with 8 reciters, including the Haramain imams. It highlights each ayah as it plays, repeats the portion 1, 3 or 5 times, and plays at 0.75× to 1.25×.
- **Recite:** recite from memory and the AI follows word by word, marking skipped, wrong and extra words. Every practice is recorded.
- **Adhkar:** morning, evening, after-prayer and sleep adhkar, with a tap counter (1/3, 2/3, 3/3) and recitation audio.
- **History:** every recording with its marks. Tap a mark to hear that moment, and share a summary.

**Teacher view (same app)**
- Keep a student list.
- Run in-person live sessions: the page follows the recitation, AI suggestions appear, and the teacher confirms them, dismisses them or adds marks.
- The whole session is recorded.
- Grade with the 4-part rubric (hifz 40, tajweed 30, makharij 20, waqf 10), add a comment, and choose pass or repeat.

## Limits of this version

- **Data stays on one device.** It is saved in the browser (localStorage, plus IndexedDB for audio). Accounts, cloud sync, parent access and online video sessions are next.
- **The AI check needs a supported browser.** It uses the browser's speech engine: Chrome, Edge or Safari, in Arabic. It checks words only, not tajweed. Without a speech engine, students tap the words they got wrong.

## Content sources (free)

- **Quran text:** Tanzil Uthmani (Madinah Mushaf, Hafs), via [Al Quran Cloud](https://alquran.cloud/terms-and-conditions)
- **Recitations:** [Islamic Network CDN](https://alquran.cloud/cdn). Reciters keep their copyrights.
- **Adhkar:** Hisn al-Muslim. Pending review by the academic lead.
- **Fonts:** Amiri Quran, IBM Plex Sans and IBM Plex Sans Arabic (Google Fonts, SIL Open Font License)

## Run locally

Serve the folder with any static server, for example `python3 -m http.server`. Then open `http://localhost:8000`.

Run the browser test: `node tests/e2e.mjs`. It needs Playwright. The Quran API, audio and speech engine are simulated.

## Deploy

The site is static, so GitHub Pages serves the `main` branch root as-is. No build step is needed.
