#!/usr/bin/env python3
"""Builds the static, crawlable pages (SEO / AEO / GEO) for rattilmai.com.

Run from the repo root:  python3 tools/build-pages.py
Writes: about/, faq/, ar/, privacy/, terms/ (index.html each), sitemap.xml, robots.txt, llms.txt
Search engines and AI answer engines read these without running JavaScript.
"""
import json, os, datetime, html

SITE = 'https://rattilmai.com'
TODAY = datetime.date.today().isoformat()
NAME_EN, NAME_AR = 'Recite With Me', 'رتّل معي'
OG = f'{SITE}/icons/og-image.jpg'

ORG = {'@type': 'Organization', '@id': f'{SITE}/#org', 'name': NAME_EN, 'alternateName': [NAME_AR, "Rattil Ma'i"],
       'url': SITE + '/', 'logo': f'{SITE}/icons/icon-512.png', 'email': 'contact@rattilmai.com',
       'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer support', 'email': 'contact@rattilmai.com', 'availableLanguage': ['English', 'Arabic']}}
SITE_LD = {'@type': 'WebSite', '@id': f'{SITE}/#website', 'name': NAME_EN, 'alternateName': NAME_AR, 'url': SITE + '/',
           'inLanguage': ['en', 'ar'], 'publisher': {'@id': f'{SITE}/#org'}}
APP_LD = {'@type': 'WebApplication', '@id': f'{SITE}/#app', 'name': NAME_EN, 'alternateName': NAME_AR, 'url': SITE + '/',
          'applicationCategory': 'EducationalApplication', 'operatingSystem': 'Web, iOS, Android (in the browser)',
          'browserRequirements': 'Requires JavaScript. The AI check needs Chrome, Edge or Safari.',
          'inLanguage': ['en', 'ar'], 'isAccessibleForFree': True, 'image': OG,
          'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
          'description': 'Free Quran memorization (hifz) app: daily sabaq, sabqi and manzil plan, AI word-by-word recitation check, free live video sessions with your teacher, parent reports, adhkar, duas, Ruqyah, prayer times and Qibla.',
          'featureList': ['Daily hifz plan: sabaq, sabqi, manzil', 'AI recitation check word by word with the correct word played back',
                          'Madinah Mushaf (Hafs) with 34 reciters, including the imams of al-Haram and an-Nabawi, ayah highlighting and repeat', 'Free 1:1 video sessions with live teacher marks and grading out of 100',
                          'Weekly and monthly reports for parents', 'Morning and evening adhkar with counter', 'Short and full Ruqyah and a Hisn al-Muslim duas library',
                          'Prayer times (Umm al-Qura, UAE Awqaf and more) and Qibla compass', 'Light and dark mode, works offline'],
          'publisher': {'@id': f'{SITE}/#org'}}

FAQ_EN = [
  ('What is Recite With Me (رتّل معي)?',
   'Recite With Me, in Arabic رتّل معي (Rattil Maʿī), is a free web app for memorizing the Quran. It gives each student a daily plan (new lesson, recent revision and old revision), listens as you recite and marks mistakes word by word, and lets teachers hold free live video sessions where they confirm the AI’s marks, add their own and grade the recitation. It also includes adhkar, duas, Ruqyah, prayer times, the Qibla and weekly reports for parents.'),
  ('Is Recite With Me free?',
   'Yes. The app is free to use and has no ads. Video sessions between a teacher and a student are free as well.'),
  ('Which Quran text and recitation standard does it follow?',
   'It follows the standard of Masjid al-Haram and Masjid an-Nabawi: the riwayah of Hafs ʿan ʿĀṣim and the Uthmani script of the Madinah Mushaf (Tanzil text). You can listen to 34 reciters ayah by ayah, including the imams of al-Haram and an-Nabawi (as-Sudais, ash-Shuraim, Maher al-Muaiqly, Yasser ad-Dosari, Abdullah al-Juhany, Ali al-Hudhaify, Salah al-Budair), teachers such as al-Husary (including his teaching style) and Ayman Suwayd, and Abdul Basit, al-Minshawi, Mishary Alafasy, Saad al-Ghamdi and others.'),
  ('How does the AI recitation check work?',
   'You recite from memory while the words stay hidden. The app listens through your browser’s speech engine, follows you word by word, and reveals each word as you say it. If you skip a word, say the wrong word or add one, it marks it straight away and lets you play the correct word or the whole ayah. It checks the words, not the rules of tajweed, and it does not replace a teacher.'),
  ('Can my teacher listen to me online?',
   'Yes. The teacher shares a 6-letter class code; the student joins with it. The teacher can then start a free video session from the app. The AI listens on the student’s phone and the teacher sees its suggestions live, confirms or dismisses them, adds marks of their own, and grades the recitation out of 100 with a pass or repeat decision. The whole session is recorded with every mark.'),
  ('What are sabaq, sabqi and manzil?',
   'They are the three parts of the traditional daily hifz routine. Sabaq is the new lesson memorized today; sabqi is the revision of the recent lessons (in the app, the last 10 pages); manzil is the revision of older portions (20 pages in rotation). You choose half a page, one page or two pages of new memorization each day.'),
  ('How can parents follow their child’s progress?',
   'The app makes weekly and monthly reports: days active, time spent reciting, new pages, AI accuracy, teacher grades and comments, the number and type of mistakes, the exact words to revise, and adhkar completed. Reports can be shared on WhatsApp or saved as a PDF.'),
  ('Do I need an account?',
   'Students and teachers sign in with their Google account, so their progress, recordings and teacher stay with them on every device.'),
  ('Does it work on iPhone and Android?',
   'Yes, in the browser on any phone, tablet or computer. Add it to your home screen to use it full screen like an app. The AI recitation check needs Chrome, Edge or Safari.'),
  ('How are prayer times and the Qibla calculated?',
   'Prayer times are calculated on your device using the method of your country, such as Umm al-Qura (Saudi Arabia), the UAE Awqaf method with its 3-minute precautions, the Muslim World League, Egypt, Karachi or ISNA, with Standard or Hanafi Asr. You can adjust each prayer by minutes to match your mosque. The Qibla direction uses the great-circle bearing to the Kaaba, with a live compass on phones. Your location stays on your device.'),
  ('How do I get a teacher, and can I teach?',
   'Students can ask the academy for a teacher in the app (Find me a teacher). They choose their languages and, if they wish, a male or female teacher, and the academy matches them with a verified teacher who speaks that language. Quran teachers from any country can apply at rattilmai.com/teach/ with their languages, years of experience and ijazah.'),
  ('Is my data private?',
   'Recordings are kept in private storage and can be opened only by you and the teacher you joined. The app has no advertising and does not sell data. Video calls connect the two devices directly and are encrypted.'),
]

FAQ_AR = [
  ('ما هو تطبيق «رتّل معي»؟',
   '«رتّل معي» (Recite With Me) تطبيق مجاني على الويب لحفظ القرآن الكريم. يضع لكل طالب خطة يومية (الدرس الجديد، والمراجعة القريبة، والمراجعة البعيدة)، ويستمع إلى تلاوتك ويحدّد الأخطاء كلمةً كلمة، ويتيح للمعلم جلسات فيديو مباشرة مجانية يؤكد فيها ملاحظات الذكاء الاصطناعي ويضيف ملاحظاته ويقيّم التلاوة. ويضم أيضًا الأذكار والأدعية والرقية الشرعية ومواقيت الصلاة واتجاه القبلة وتقارير أسبوعية لأولياء الأمور.'),
  ('هل التطبيق مجاني؟', 'نعم، التطبيق مجاني بالكامل ومن دون إعلانات، وجلسات الفيديو بين المعلم والطالب مجانية أيضًا.'),
  ('ما الرواية والمصحف المعتمدان؟', 'يعتمد التطبيق رواية حفص عن عاصم والرسم العثماني لمصحف المدينة النبوية، على منهج المسجد الحرام والمسجد النبوي، مع ٣٤ قارئًا آيةً آية، منهم أئمة الحرمين: السديس والشريم والمعيقلي والدوسري والجهني والحذيفي والبدير، والحصري (ومنه المصحف المعلم) وأيمن سويد والمنشاوي وعبد الباسط والعفاسي والغامدي.'),
  ('كيف يعمل التصحيح بالذكاء الاصطناعي؟', 'تتلو من حفظك والكلمات مخفية، فيتابعك التطبيق كلمةً كلمة ويُظهر كل كلمة عند نطقها. إذا أسقطت كلمة أو أخطأت فيها أو زدت كلمة ظهر الخطأ فورًا مع زر لسماع الكلمة الصحيحة أو الآية كاملة. يتحقق من الكلمات لا من أحكام التجويد، ولا يغني عن المعلم.'),
  ('كيف يتابعني المعلم عن بُعد؟', 'يشارك المعلم رمز الحلقة المكوّن من ستة أحرف، فينضم الطالب به، ثم يبدأ المعلم جلسة فيديو مجانية. يستمع الذكاء الاصطناعي على جهاز الطالب ويرى المعلم اقتراحاته مباشرة فيؤكدها أو يرفضها ويضيف ملاحظاته، ثم يمنح درجة من مئة مع قرار النجاح أو الإعادة، وتُسجَّل الجلسة كاملة.'),
  ('كيف يتابع ولي الأمر تقدّم ابنه؟', 'يُعدّ التطبيق تقارير أسبوعية وشهرية تشمل أيام النشاط ومدة التلاوة والصفحات الجديدة ودرجات المعلم وملاحظاته وعدد الأخطاء ونوعها والكلمات التي تحتاج إلى مراجعة والأذكار المنجزة، ويمكن مشاركتها عبر واتساب أو حفظها PDF.'),
  ('هل يعمل على الآيفون والأندرويد؟', 'نعم، يعمل في المتصفح على أي هاتف أو جهاز لوحي أو حاسوب، ويمكن إضافته إلى الشاشة الرئيسية ليعمل بملء الشاشة كالتطبيق.'),
]

CSS = '''
.site { max-width: 820px; margin: 0 auto; padding: 24px 18px 56px; }
.site-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: var(--topbar-bg); position: sticky; top: 0; z-index: 5; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.site-head .brand img.wordmark { height: 46px; width: auto; }
.site h1 { font-size: 30px; line-height: 1.2; margin: 18px 0 10px; }
.site h2 { font-size: 21px; margin: 30px 0 10px; }
.site p, .site li { font-size: 16.5px; line-height: 1.7; color: var(--ink-2); }
.site ul { padding-inline-start: 22px; }
.site .lead { font-size: 18.5px; color: var(--ink); }
.site details { border: 1px solid var(--line); border-radius: 16px; padding: 4px 16px; margin: 10px 0; background: var(--card); }
.site summary { cursor: pointer; font-weight: 600; font-size: 17px; padding: 12px 0; color: var(--ink); }
.site details p { margin: 0 0 14px; }
.site-foot { border-top: 1px solid var(--line); padding: 22px 18px 40px; text-align: center; font-size: 14px; color: var(--muted); }
.site-foot nav { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: center; margin-bottom: 10px; }
.cta { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0 8px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.grid2 .card h3 { margin-bottom: 6px; }
[dir="rtl"] .site { font-family: var(--ar); }
'''

def page(path, lang, title, desc, body, ld_extra=(), alt=None):
    canonical = f'{SITE}{path}'
    dir_ = 'rtl' if lang == 'ar' else 'ltr'
    graph = [ORG, SITE_LD] + list(ld_extra)
    alts = ''
    if alt:
        alts = ''.join(f'<link rel="alternate" hreflang="{h}" href="{SITE}{u}">' for h, u in alt)
    nav = [('/', 'Open the app' if lang == 'en' else 'افتح التطبيق'), ('/about/', 'About' if lang == 'en' else 'عن التطبيق'),
           ('/faq/', 'FAQ' if lang == 'en' else 'الأسئلة الشائعة'), ('/ar/' if lang == 'en' else '/about/', 'العربية' if lang == 'en' else 'English'),
           ('/teach/', 'Teach with us' if lang == 'en' else 'علّم معنا'), ('/privacy/', 'Privacy' if lang == 'en' else 'الخصوصية'), ('/terms/', 'Terms' if lang == 'en' else 'الشروط')]
    return f'''<!doctype html>
<html lang="{lang}" dir="{dir_}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{canonical}">
{alts}
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#F7F3EA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1411" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME_EN} · {NAME_AR}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{'ar_AE' if lang == 'ar' else 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{OG}">
<link rel="icon" href="/icons/icon-small.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/app.css">
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False)}</script>
</head>
<body>
<header class="site-head">
  <a class="brand" href="/" aria-label="{NAME_EN} · {NAME_AR}"><img src="/icons/icon-small.svg" alt="" width="40" height="40"><img class="wordmark wm-light" src="/icons/wordmark-light.svg" alt="{NAME_EN} · {NAME_AR}" width="110" height="46"><img class="wordmark wm-dark" src="/icons/wordmark-dark.svg" alt="" width="110" height="46"></a>
  <a class="btn sm" href="/">{'Open the app' if lang == 'en' else 'افتح التطبيق'}</a>
</header>
<main class="site">
{body}
</main>
<footer class="site-foot">
  <nav aria-label="{'Site' if lang == 'en' else 'روابط'}">{''.join(f'<a href="{u}">{html.escape(t)}</a>' for u, t in nav)}</nav>
  <div>{NAME_EN} · <span lang="ar">{NAME_AR}</span> · rattilmai.com</div>
</footer>
</body>
</html>
'''

def faq_ld(items):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in items]}

def crumbs(name, path):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': NAME_EN, 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': name, 'item': SITE + path}]}

def faq_html(items):
    return '\n'.join(f'<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for q, a in items)

pages = {}

pages['about/index.html'] = page('/about/', 'en',
  'About Recite With Me · رتّل معي — Quran memorization with AI and live teachers',
  'Recite With Me (رتّل معي) is a free Quran hifz app: a daily sabaq, sabqi and manzil plan, an AI that checks your recitation word by word, free live video sessions with your teacher and weekly reports for parents.',
  f'''<article>
<p class="eyebrow">About</p>
<h1>Memorize the Quran with a daily plan, an AI that listens, and your teacher</h1>
<p class="lead">Recite With Me — <span lang="ar">رتّل معي</span>, “Rattil Maʿī” — is a free web app for memorizing the Quran to the standard of Masjid al-Haram and Masjid an-Nabawi: Hafs ʿan ʿĀṣim, Madinah Mushaf. It joins the three things a student needs in one place: a clear daily plan, an AI that listens every day, and a teacher who checks and grades.</p>
<div class="cta"><a class="btn" href="/">Open the app</a><a class="btn outline" href="/faq/">Read the FAQ</a></div>
<h2>For students</h2>
<ul>
<li><b>A daily hifz plan</b> with the new lesson (sabaq), recent revision (sabqi) and old revision (manzil). Choose half a page, one page or two pages a day.</li>
<li><b>Listen first</b> in a page-by-page Madinah Mushaf with 34 reciters, including the imams of al-Haram and an-Nabawi, ayah highlighting, repeat and speed control.</li>
<li><b>Recite from memory</b> while the words stay hidden. The AI follows you word by word, marks skipped, wrong and extra words straight away, and plays the correct word or ayah.</li>
<li><b>Every recitation is recorded</b> with its marks, so you can hear the exact moment of each mistake.</li>
</ul>
<h2>For teachers</h2>
<ul>
<li>A class code your students join with their Google account.</li>
<li><b>Free live video sessions</b> in the browser. The AI listens on the student’s phone and you see its suggestions live; confirm them, dismiss them or add your own marks.</li>
<li>Grade out of 100 (hifz 40, tajweed 30, makharij 20, waqf 10) with a comment and a pass or repeat decision. The whole session is recorded.</li>
<li>Review and grade students’ AI practice recordings, and hold in-person sessions on your own device.</li>
</ul>
<h2>For parents</h2>
<p>Weekly and monthly reports show active days, time spent reciting, new pages, teacher grades and comments, the number and type of mistakes, and the exact words to revise. Share them on WhatsApp or save them as a PDF.</p>
<h2>Daily worship</h2>
<p>Morning, evening, after-prayer and sleep adhkar with a counter; short and full Ruqyah; a Hisn al-Muslim duas library; prayer times by your country’s method (Umm al-Qura, UAE Awqaf, Muslim World League and more) with a Qibla compass. Quranic texts always come from the Mushaf text, never retyped.</p>
<h2>Sources</h2>
<p>Quran text: Tanzil Uthmani (Madinah Mushaf, Hafs) via Al Quran Cloud. Recitations: Islamic Network CDN and EveryAyah.com, ayah by ayah. Adhkar and duas: Hisn al-Muslim, with references. Fonts: Alexandria, IBM Plex Sans and Amiri Quran.</p>
</article>''', [APP_LD, crumbs('About', '/about/')], alt=[('en', '/about/'), ('ar', '/ar/'), ('x-default', '/')])

pages['faq/index.html'] = page('/faq/', 'en',
  'Recite With Me FAQ — Quran hifz app, AI recitation check, teacher sessions',
  'Answers about Recite With Me (رتّل معي): is it free, which Mushaf it follows, how the AI recitation check works, live teacher video sessions, sabaq, sabqi and manzil, parent reports, prayer times and privacy.',
  f'''<article>
<p class="eyebrow">Frequently asked questions</p>
<h1>Recite With Me: questions and answers</h1>
<p class="lead">Short answers about the app, the AI recitation check, teacher sessions and reports for parents.</p>
{faq_html(FAQ_EN)}
<div class="cta"><a class="btn" href="/">Open the app</a><a class="btn outline" href="/ar/">الأسئلة بالعربية</a></div>
</article>''', [faq_ld(FAQ_EN), crumbs('FAQ', '/faq/')], alt=[('en', '/faq/'), ('ar', '/ar/'), ('x-default', '/')])

pages['ar/index.html'] = page('/ar/', 'ar',
  'رتّل معي — تطبيق مجاني لحفظ القرآن الكريم مع الذكاء الاصطناعي والمعلم',
  '«رتّل معي» تطبيق مجاني لحفظ القرآن الكريم: خطة يومية للدرس والمراجعة، وتصحيح التلاوة بالذكاء الاصطناعي كلمةً كلمة، وجلسات فيديو مجانية مع المعلم، وتقارير لأولياء الأمور، والأذكار ومواقيت الصلاة.',
  f'''<article>
<p class="eyebrow">رتّل معي · Recite With Me</p>
<h1>احفظ القرآن الكريم بخطة يومية، وذكاء اصطناعي يستمع إليك، ومعلّم يتابعك</h1>
<p class="lead">«رتّل معي» تطبيق مجاني على الويب لحفظ القرآن الكريم على منهج المسجد الحرام والمسجد النبوي: رواية حفص عن عاصم ومصحف المدينة النبوية.</p>
<div class="cta"><a class="btn" href="/">افتح التطبيق</a></div>
<div class="grid2">
<div class="card"><h3>للطالب</h3><p>خطة يومية للدرس الجديد والمراجعة القريبة والبعيدة، واستماع لـ٣٤ قارئًا منهم أئمة الحرمين مع تظليل الآية، وتلاوة من الحفظ يتابعها الذكاء الاصطناعي كلمةً كلمة ويُسمعك الصواب فورًا.</p></div>
<div class="card"><h3>للمعلّم</h3><p>رمز للحلقة، وجلسات فيديو مباشرة مجانية تظهر فيها ملاحظات الذكاء الاصطناعي، وتقييم من مئة مع قرار النجاح أو الإعادة، وتسجيل كامل للجلسة.</p></div>
<div class="card"><h3>لولي الأمر</h3><p>تقارير أسبوعية وشهرية بالأيام والمدة والصفحات الجديدة والأخطاء والكلمات التي تحتاج إلى مراجعة وملاحظات المعلم، قابلة للمشاركة عبر واتساب.</p></div>
<div class="card"><h3>للعبادة اليومية</h3><p>أذكار الصباح والمساء وبعد الصلاة والنوم مع عدّاد، والرقية الشرعية المختصرة والكاملة، وحصن المسلم، ومواقيت الصلاة واتجاه القبلة.</p></div>
</div>
<h2>الأسئلة الشائعة</h2>
{faq_html(FAQ_AR)}
</article>''', [APP_LD, faq_ld(FAQ_AR)], alt=[('en', '/about/'), ('ar', '/ar/'), ('x-default', '/')])

pages['teach/index.html'] = page('/teach/', 'en',
  'Teach the Quran online with Recite With Me · رتّل معي — apply as a teacher',
  'Quran teachers from every country can apply to Recite With Me: teach hifz, tajweed and Noorani Qaida live on video, with an AI that follows every word. Students are matched to you by language.',
  f'''<article>
<p class="eyebrow">For teachers</p>
<h1>Teach the Quran with Recite With Me</h1>
<p class="lead">We welcome qualified Quran teachers from every country. Students and parents ask the academy for a teacher in their language — Arabic, English, Urdu, Malay, Indonesian, Turkish, French, Bengali and more — and we match them with a verified teacher who speaks it.</p>
<div class="cta"><a class="btn" href="/#/apply">Apply to teach</a><a class="btn outline" href="/about/">About the app</a></div>
<h2>How it works</h2>
<ul>
<li><b>Apply</b> with your Google account: your languages, years of teaching, ijazah and sanad, studies, a short bio and the times you are free.</li>
<li><b>Record your recitation test</b> in the form: one surah from memory, at least 10 ayahs, with full tajweed, in a quiet room.</li>
<li><b>We review</b> every application and listen to every recitation. Teaching opens only after approval, and approved teachers get a verified profile that students and parents can see.</li>
<li><b>Students are matched</b> to you by language, by teacher gender if the family asks, and by the number of students you want.</li>
<li><b>Teach live</b> on free video in the browser. The AI listens on the student's phone and shows you what it hears; you confirm, add your own marks and grade out of 100.</li>
<li>Every session is <b>recorded with your marks</b>, and parents get weekly and monthly reports.</li>
</ul>
<h2>Who can apply</h2>
<p>Teachers of Quran reading (nazra), Noorani Qaida, hifz, tajweed and ijazah, for children and adults. Male teachers and female teachers are both needed, especially for girls and women.</p>
</article>''', [crumbs('Teach', '/teach/')])

pages['privacy/index.html'] = page('/privacy/', 'en',
  'Privacy policy — Recite With Me · رتّل معي',
  'How Recite With Me handles your data: Google sign-in, recordings, marks and progress, video calls, speech recognition and prayer location. No ads, no selling of data.',
  f'''<article>
<p class="eyebrow">Privacy</p>
<h1>Privacy policy</h1>
<p class="lead">Recite With Me is built for Quran students, their teachers and their families. We collect only what the app needs to work, we show no advertising, and we never sell data. Last updated {TODAY}.</p>
<h2>What we store</h2>
<ul>
<li><b>Your Google account basics</b> when you sign in: name, email address and profile photo, used to identify you and to show you to your linked teacher or students.</li>
<li><b>Your learning record:</b> your hifz plan, daily progress, adhkar counts, app settings, recitation recordings, the marks on each recording, grades and teacher comments.</li>
<li><b>Class links:</b> which teacher a student has joined with a class code.</li>
<li><b>Teacher applications:</b> if you apply to teach, the details you give (languages, experience, ijazah, bio, availability and an optional WhatsApp number). Approved teachers' profile cards are shown to signed-in users; the phone number is seen only by academy admins.</li>
<li><b>Parent report emails:</b> if a student adds a parent's email, we store it and send a confirmation first. Only after the parent confirms do weekly and monthly progress reports go out, sent through our email provider (Resend). Every email has a link to stop them, and the student can remove the address at any time.</li>
<li><b>Teacher requests:</b> if you ask for a teacher, the student's name, languages, age group and notes, seen by academy admins and the teacher you are matched with.</li>
</ul>
<h2>Who can see it</h2>
<p>Your recordings and marks are kept in private storage. Only you and a teacher you have joined can open them. A teacher can see the plan progress of students who joined their class. You can leave a teacher’s class at any time in Settings.</p>
<h2>Video sessions</h2>
<p>Video calls connect the teacher’s and the student’s devices directly and are encrypted in transit. The connection is set up through our server, which does not receive the video. The teacher’s device records the session audio, which is saved with the marks and grade.</p>
<h2>Speech recognition</h2>
<p>The AI recitation check uses your browser’s built-in speech recognition. Depending on your browser, the audio may be processed by the browser maker’s service (for example Google in Chrome or Apple in Safari) under their own privacy terms.</p>
<h2>Prayer location</h2>
<p>The city or coordinates you choose for prayer times and the Qibla stay on your device. They are not sent to our servers.</p>
<h2>Where data is kept</h2>
<p>The app is hosted on Vercel. Accounts, records and recordings are stored with Supabase in the European Union (Frankfurt).</p>
<h2>Your choices</h2>
<p>You can delete your own recordings in the app, sign out at any time, and ask us to delete your account and all of its data. Children should use the app with a parent’s or teacher’s permission.</p>
<h2>Contact</h2>
<p>Questions, or a request to delete your account and its data: email <a href="mailto:contact@rattilmai.com">contact@rattilmai.com</a>. Send it from the Google account you sign in with, so we can find your data. We reply within a few days.</p>
</article>''', [crumbs('Privacy', '/privacy/')])

pages['terms/index.html'] = page('/terms/', 'en',
  'Terms of use — Recite With Me · رتّل معي',
  'The terms for using Recite With Me, a free Quran memorization web app.',
  f'''<article>
<p class="eyebrow">Terms</p>
<h1>Terms of use</h1>
<p class="lead">By using Recite With Me you agree to these terms. Last updated {TODAY}.</p>
<h2>The service</h2>
<p>Recite With Me is a free tool to help memorize and revise the Quran, with optional teacher sessions. The AI recitation check is a study aid: it checks words, not tajweed, and it can be wrong. It does not replace a qualified teacher.</p>
<h2>Accounts</h2>
<p>You sign in with your Google account and are responsible for activity on it. Teachers must use the app respectfully and only with students who have joined their class.</p>
<h2>Content</h2>
<p>The Quran text, recitations and other religious texts come from the sources named in the app and belong to their respective owners. Recordings you make belong to you; you allow us to store them so that you and your teacher can use them in the app.</p>
<h2>Acceptable use</h2>
<p>Do not misuse the service, attempt to access other people’s data, or use video sessions for anything other than learning.</p>
<h2>Changes</h2>
<p>We may improve or change the service and these terms. Continued use means you accept the updated terms.</p>
<h2>Contact</h2>
<p>Email <a href="mailto:contact@rattilmai.com">contact@rattilmai.com</a>.</p>
</article>''', [crumbs('Terms', '/terms/')])

# Landing pages for the links in parent report emails (not indexed).
for slug, title, text in [
    ('confirmed', 'Reports confirmed', 'Thank you. You will now receive the weekly report every Sunday morning and the monthly report on the 1st of each month. Every email has a link to stop them.'),
    ('stopped', 'Emails stopped', 'You will not receive any more progress reports at this address. The student can add it again in the app at any time; it would need your confirmation again.'),
    ('invalid', 'Link not valid', 'This link is not valid any more. Ask the student to send a new confirmation from Settings in Recite With Me.'),
]:
    pages[f'parents/{slug}/index.html'] = page(f'/parents/{slug}/', 'en', f'{title} — Recite With Me', text,
        f'<article class="stack"><p class="eyebrow">Reports for parents</p><h1>{html.escape(title)}</h1><p class="lead">{html.escape(text)}</p><div class="cta"><a class="btn" href="/">Open Recite With Me</a></div></article>', [])
    pages[f'parents/{slug}/index.html'] = pages[f'parents/{slug}/index.html'].replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">')

for path, content in pages.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(content)

urls = [('/', 1.0, [('en', '/'), ('ar', '/ar/')]), ('/about/', 0.9, [('en', '/about/'), ('ar', '/ar/')]), ('/faq/', 0.9, [('en', '/faq/'), ('ar', '/ar/')]),
        ('/ar/', 0.9, [('en', '/about/'), ('ar', '/ar/')]), ('/teach/', 0.8, []), ('/privacy/', 0.3, []), ('/terms/', 0.3, [])]
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for u, pr, alts in urls:
    sm.append(f'  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{h}" href="{SITE}{a}"/>' for h, a in alts) + '</url>')
sm.append('</urlset>')
open('sitemap.xml', 'w').write('\n'.join(sm) + '\n')

open('robots.txt', 'w').write(f'''# Recite With Me · رتّل معي
User-agent: *
Allow: /

# AI answer engines and assistants are welcome to read and cite the public pages.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: {SITE}/sitemap.xml
''')

faq_txt = '\n'.join(f'- **{q}** {a}' for q, a in FAQ_EN)
open('llms.txt', 'w').write(f'''# Recite With Me (رتّل معي)

> Recite With Me — in Arabic رتّل معي, “Rattil Maʿī” — is a free web app at {SITE} for memorizing the Quran (hifz) to the standard of Masjid al-Haram and Masjid an-Nabawi (Hafs ʿan ʿĀṣim, Madinah Mushaf). It combines a daily sabaq/sabqi/manzil plan, an AI that checks recitation word by word, free live video sessions where teachers confirm AI marks and grade out of 100, weekly and monthly parent reports, adhkar, duas, Ruqyah, prayer times and the Qibla. Free, no ads, English and Arabic.

## Pages
- [About]({SITE}/about/): what the app does for students, teachers and parents
- [FAQ]({SITE}/faq/): short answers about the AI check, teacher sessions, reports, prayer times and privacy
- [العربية]({SITE}/ar/): Arabic overview and FAQ
- [Teach with us]({SITE}/teach/): how Quran teachers apply and how students are matched by language
- [Privacy]({SITE}/privacy/) · [Terms]({SITE}/terms/)
- [Open the app]({SITE}/)

## Key facts
- Price: free, no advertising
- Standard: riwayah Hafs ʿan ʿĀṣim, Uthmani script of the Madinah Mushaf (Tanzil text)
- Reciters: 34, ayah by ayah — as-Sudais, ash-Shuraim, Maher al-Muaiqly, Yasser ad-Dosari, al-Juhany, al-Hudhaify, al-Budair, al-Husary (also Muʿallim), Ayman Suwayd, al-Minshawi, Abdul Basit, Alafasy, al-Ghamdi and more
- AI check: browser speech recognition, word level (skipped, wrong, extra words); not tajweed
- Teacher sessions: class code, free 1:1 video in the browser, live AI suggestions, teacher marks, grade out of 100 (hifz 40, tajweed 30, makharij 20, waqf 10), pass or repeat, full recording
- Parent reports: weekly and monthly; mistakes by type, words to revise, teacher feedback, adhkar
- Prayer times: Umm al-Qura, UAE Awqaf (with 3-minute precautions), MWL, Egypt, Karachi, ISNA and more; per-prayer adjustments; location stays on device
- Sign-in: Google account

## FAQ
{faq_txt}
''')
print('built', len(pages), 'pages + sitemap.xml, robots.txt, llms.txt')
