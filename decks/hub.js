// The /decks hub, in English (/decks/) and Arabic (/decks/ar/). The page's lang picks the strings.
const AR = document.documentElement.lang === 'ar';
const toAr = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const L = AR ? {
  link: 'https://rattilmai.com/decks/ar/',
  chapters: [[0, 'المقدمة'], [15.6, 'التحدّي'], [30.0, 'تطبيق واحد لثلاثة أطراف'], [38.2, 'الخطة اليومية'], [60.2, 'الاستماع'], [78.4, 'التسميع من الحفظ'], [89.7, 'تقدّم صادق'], [98.0, 'معلّمون موثَّقون'], [120.3, 'دروس مباشرة'], [146.2, 'تقارير للوالدين'], [173.6, 'عبادة اليوم'], [185.3, 'المصادر'], [207.4, 'المبادئ'], [221.9, 'ابدأ اليوم']],
  msg: (link) => `السلام عليكم ورحمة الله وبركاته،

هذه نظرة سريعة على «رتّل معي» (Recite With Me)، تطبيق حفظ القرآن الكريم: فيلم تعريفي قصير بصوت راوٍ، وعرض تقديمي عن التطبيق.

${link}
رمز الدخول: 24434

افتح الرابط وأدخل الرمز، فيظهر لك الفيلم والعرض. نرجو عدم نشر الرمز علنًا.`,
  subject: 'رتّل معي: الفيلم التعريفي والعرض التقديمي',
  copy: 'نسخ الرسالة', copied: 'تم النسخ', copyPrompt: 'انسخ هذه الرسالة:',
  publicText: '«رتّل معي»: احفظ القرآن الكريم بخطة يومية، وتطبيق يتابع كل كلمة، ودروس مباشرة مع معلّم موثَّق. الفيلم والعرض:',
  film: '../media/recite-with-me-film-ar-720p.mp4', filmName: 'Ratil-Maai-film-ar.mp4', filmTitle: 'فيلم رتّل معي',
  save: 'حفظ الفيلم في الصور', preparing: 'جارٍ تجهيز الفيلم…', ready: 'جاهز: اضغط للحفظ في الصور', failed: 'تعذّر تجهيز الفيلم، حاول مرة أخرى',
} : {
  link: 'https://rattilmai.com/decks/',
  chapters: [[0, 'Introduction'], [12, 'The challenge'], [24.7, 'One app, three people'], [31.8, 'The daily plan'], [53.7, 'Listen'], [68.8, 'Recite from memory'], [80.2, 'Honest progress'], [87.8, 'Verified teachers'], [104.7, 'Live online lessons'], [130.9, 'Reports for parents'], [153.3, 'Daily worship'], [164.3, 'Sources'], [183.4, 'Principles'], [197.9, 'Start today']],
  msg: (link) => `Assalamu alaikum,

Here is a short look at Recite With Me (رتّل معي), the Quran memorization app: a 3-minute narrated film and the product deck.

${link}
Passcode: 24434

Open the link, enter the passcode, and both the film and the deck will open. Please keep the passcode private.`,
  subject: 'Recite With Me: film and pitch deck',
  copy: 'Copy message', copied: 'Copied', copyPrompt: 'Copy this message:',
  publicText: 'Recite With Me (رتّل معي): memorize the Quran with a daily plan, an AI that follows every word, and live online lessons with a verified teacher. The film and the deck:',
  film: 'media/recite-with-me-film-720p.mp4', filmName: 'Recite-With-Me-film.mp4', filmTitle: 'Recite With Me film',
  save: 'Save the film to Photos', preparing: 'Preparing the film…', ready: 'Ready: tap to save to Photos', failed: 'Could not prepare the film. Try again',
};
const num = (x) => (AR ? toAr(x) : String(x));

// Chapter buttons for the film (seconds into the video).
const v = document.getElementById('film');
const fmt = (s) => num(`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const box = document.getElementById('chapters');
box.innerHTML = L.chapters.map(([t, l]) => `<button class="chapter" type="button" data-t="${t}"><b>${fmt(t)}</b><span>${l}</span></button>`).join('');
box.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  v.currentTime = +b.dataset.t;
  v.play().catch(() => {});
});

// Share the page: WhatsApp, email, copy, or the phone's own share menu. The message carries the passcode.
const MSG = L.msg(L.link);
document.getElementById('shWa').href = `https://wa.me/?text=${encodeURIComponent(MSG)}`;
document.getElementById('shMail').href = `mailto:?subject=${encodeURIComponent(L.subject)}&body=${encodeURIComponent(MSG)}`;
const copyBtn = document.getElementById('shCopy');
copyBtn.addEventListener('click', async () => {
  const label = copyBtn.querySelector('span');
  try { await navigator.clipboard.writeText(MSG); label.textContent = L.copied; }
  catch { window.prompt(L.copyPrompt, MSG); }
  setTimeout(() => { label.textContent = L.copy; }, 2000);
});
if (navigator.share) {
  const more = document.getElementById('shMore');
  more.hidden = false;
  more.addEventListener('click', () => navigator.share({ title: L.subject, text: MSG }).catch(() => {}));
}

// Social media: public posts carry the link only (no passcode); Telegram goes to chosen people, so it carries the message.
const u = encodeURIComponent(L.link);
document.getElementById('soX').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(L.publicText)}&url=${u}`;
document.getElementById('soFb').href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
document.getElementById('soLi').href = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
document.getElementById('soTg').href = `https://t.me/share/url?url=${u}&text=${encodeURIComponent(MSG.replace(L.link + '\n', ''))}`;

// Downloads: each link gets a signed key (6 hours) so the phone's download manager, which does not send
// the passcode cookie, still receives the file and saves it instead of playing it.
const dls = [...document.querySelectorAll('a.dl')];
fetch('/decks/token/', { credentials: 'same-origin', cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    if (!j || !j.t) return;
    dls.forEach((a) => { a.href = `${a.getAttribute('href').split('?')[0]}?t=${encodeURIComponent(j.t)}&dl=1`; });
  })
  .catch(() => {});

// Save to Photos: on phones that can share files (iPhone in particular), hand the video to the share
// sheet, which offers "Save Video". The 720p film is fetched first.
const saveBtn = document.getElementById('savePhotos');
let canFiles = false;
try { canFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.mp4', { type: 'video/mp4' })] })); } catch { canFiles = false; }
if (canFiles) {
  saveBtn.hidden = false;
  let file = null;
  let busy = false;
  const label = (t) => { saveBtn.textContent = t; };
  async function load() {
    const r = await fetch(L.film, { credentials: 'same-origin' });
    if (!r.ok || !r.body) throw new Error('fetch');
    const total = +r.headers.get('content-length') || 0;
    const reader = r.body.getReader();
    const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      if (total) label(`${L.preparing} ${num(Math.round((got / total) * 100))}%`);
    }
    return new File(parts, L.filmName, { type: 'video/mp4' });
  }
  async function share() {
    try { await navigator.share({ files: [file], title: L.filmTitle }); label(L.save); }
    catch (e) {
      // The first tap's permission can run out while the file loads; the next tap opens the share sheet.
      label(e && e.name === 'NotAllowedError' ? L.ready : L.save);
    }
  }
  saveBtn.addEventListener('click', async () => {
    if (busy) return;
    if (file) { share(); return; }
    busy = true; saveBtn.setAttribute('aria-busy', 'true'); label(L.preparing);
    try { file = await load(); await share(); }
    catch { label(L.failed); }
    finally { busy = false; saveBtn.removeAttribute('aria-busy'); }
  });
}
