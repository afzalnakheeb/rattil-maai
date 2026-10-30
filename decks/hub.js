// Chapter buttons for the film (seconds into the video).
const CH = [[0, 'Introduction'], [12, 'The challenge'], [24.7, 'One app, three people'], [31.8, 'The daily plan'], [53.7, 'Listen'], [68.8, 'Recite from memory'], [80.2, 'Honest progress'], [87.8, 'Verified teachers'], [104.7, 'Live online lessons'], [130.9, 'Reports for parents'], [153.3, 'Daily worship'], [164.3, 'Sources'], [183.4, 'Principles'], [197.9, 'Start today']];
const v = document.getElementById('film');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const box = document.getElementById('chapters');
box.innerHTML = CH.map(([t, l]) => `<button class="chapter" type="button" data-t="${t}"><b>${fmt(t)}</b><span>${l}</span></button>`).join('');
box.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  v.currentTime = +b.dataset.t;
  v.play().catch(() => {});
});

// Share the page: WhatsApp, email, copy, or the phone's own share menu. The message carries the passcode.
const LINK = 'https://rattilmai.com/decks/';
const MSG = `Assalamu alaikum,

Here is a short look at Recite With Me (رتّل معي), the Quran memorization app: a 3-minute narrated film and the product deck.

${LINK}
Passcode: 24434

Open the link, enter the passcode, and both the film and the deck will open. Please keep the passcode private.`;
const SUBJECT = 'Recite With Me: film and pitch deck';
document.getElementById('shWa').href = `https://wa.me/?text=${encodeURIComponent(MSG)}`;
document.getElementById('shMail').href = `mailto:?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(MSG)}`;
const copyBtn = document.getElementById('shCopy');
copyBtn.addEventListener('click', async () => {
  const label = copyBtn.querySelector('span');
  try { await navigator.clipboard.writeText(MSG); label.textContent = 'Copied'; }
  catch { window.prompt('Copy this message:', MSG); }
  setTimeout(() => { label.textContent = 'Copy message'; }, 2000);
});
if (navigator.share) {
  const more = document.getElementById('shMore');
  more.hidden = false;
  more.addEventListener('click', () => navigator.share({ title: SUBJECT, text: MSG }).catch(() => {}));
}

// Social media: public posts carry the link only (no passcode); Telegram goes to chosen people, so it carries the message.
const PUBLIC_TEXT = 'Recite With Me (رتّل معي): memorize the Quran with a daily plan, an AI that follows every word, and live online lessons with a verified teacher. The film and the deck:';
const u = encodeURIComponent(LINK);
document.getElementById('soX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(PUBLIC_TEXT)}&url=${u}`;
document.getElementById('soFb').href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
document.getElementById('soLi').href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
document.getElementById('soTg').href = `https://t.me/share/url?url=${u}&text=${encodeURIComponent(MSG.replace(LINK + '\n', ''))}`;
