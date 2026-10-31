// رتّل معي: Arabic scenes shared by the Arabic pitch deck and the Arabic narrated film (right to left).
// Every element with data-t appears at that many seconds into its scene (data-fx: rise | fade | scale | left | right | draw | grow | count).
// Times follow the Arabic narration's word timestamps. Everything is a pure function of time, so the film renders frame by frame.

const IC = {
  cal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="10" width="34" height="31" rx="6"/><path d="M7 19h34M16 6v8M32 6v8"/><path d="m18 30 4 4 8-8"/></svg>',
  ear: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="17" y="6" width="14" height="24" rx="7"/><path d="M10 23a14 14 0 0 0 28 0M24 37v6M17 43h14"/></svg>',
  home: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22 24 8l17 14"/><path d="M12 19v21h24V19"/><path d="M24 34s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 30 26c0 4.4-6 8-6 8z"/></svg>',
  user: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="24" cy="16" r="8"/><path d="M8 42c2-9 8.5-13 16-13s14 4 16 13"/></svg>',
  book: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M24 12c-5-4-11-4-17-3v29c6-1 12-1 17 3 5-4 11-4 17-3V9c-6-1-12-1-17 3zM24 12v29"/></svg>',
  mail: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="6" y="11" width="36" height="27" rx="5"/><path d="m8 14 16 12 16-12"/></svg>',
  shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M24 5 9 11v11c0 10 6.5 17 15 21 8.5-4 15-11 15-21V11z"/><path d="m17 24 5 5 9-10"/></svg>',
  lock: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="10" y="21" width="28" height="21" rx="5"/><path d="M16 21v-6a8 8 0 0 1 16 0v6M24 30v5"/></svg>',
  gift: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><rect x="8" y="18" width="32" height="24" rx="4"/><path d="M6 12h36v6H6zM24 12v30M24 12s-3-7-8-7c-3 0-4 4 0 7M24 12s3-7 8-7c3 0 4 4 0 7"/></svg>',
  scale: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6v36M14 42h20M10 12h28"/><path d="m10 12-6 14a6 6 0 0 0 12 0zM38 12l-6 14a6 6 0 0 0 12 0z"/></svg>',
  people: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="17" cy="17" r="6"/><circle cx="33" cy="19" r="5"/><path d="M5 40c1.5-7 6-10 12-10s10.5 3 12 10M29 30c5 0 9 3 11 10"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" style="transform:scaleX(-1)"><path d="M8 5.5v13l11-6.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
  star: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="m24 5 5.6 11.6L42 18.4l-9 8.8 2.2 12.6L24 33.8l-11.2 6 2.2-12.6-9-8.8 12.4-1.8z"/></svg>',
};

// Arabic-Indic digits for every number shown on screen.
export const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const phone = (img, extra = '') => `<div class="phone" ${extra}><div class="screen"><img src="img/${img}.png" alt=""></div><i class="notch"></i></div>`;

const IKHLAS = [['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ'], ['ٱللَّهُ', 'ٱلصَّمَدُ'], ['لَمْ', 'يَلِدْ', 'وَلَمْ', 'يُولَدْ'], ['وَلَمْ', 'يَكُن', 'لَّهُۥ', 'كُفُوًا', 'أَحَدٌۢ']];
let wi = 0;
const ikhlasHtml = IKHLAS.map((a, ai) => a.map((w) => `<span class="aw" data-w="${wi++}">${w}</span>`).join(' ') + ` <span class="am2">۝${AR(ai + 1)}</span>`).join(' ');
const FATIHA2 = ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَٰلَمِينَ'];

export const SCENES = [
  { id: 'title', html: `
    <div class="center col" style="gap:24px">
      <img class="logo-mark" src="img/icon-512.png" alt="" data-t="4.2" data-fx="scale">
      <div class="ar-brand" data-t="4.4">رتّل معي <small lang="en" dir="ltr">Recite With Me</small></div>
      <div class="ayah-quote" data-t="0.4" data-fx="fade"><span class="quran" lang="ar" dir="rtl">وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا</span><small>سورة المزمل · الآية ${AR(4)}</small></div>
      <p class="lead center-text" data-t="5.6">احفظ القرآن الكريم آيةً بعد آية،<br>ومعلّمك إلى جانبك، وأهلك يشهدون تقدّمك.</p>
    </div>` },

  { id: 'challenge', html: `
    <div class="pad col" style="gap:60px">
      <div><div class="eyebrow" data-t="0.1">التحدّي</div><h1 class="big" data-t="0.3">يحتاج الحفظ إلى <em>ثلاثة أمور</em>.</h1></div>
      <div class="cards3">
        <div class="card need" data-t="2.9"><i class="ic">${IC.cal}</i><h3>مداومة يومية</h3><p>قليلٌ كلَّ يوم، يُراجَع قبل أن يُنسى.</p></div>
        <div class="card need" data-t="5.4"><i class="ic">${IC.ear}</i><h3>معلّم يُصغي</h3><p>يسمع كل كلمة، فيصحّح ويوجّه.</p></div>
        <div class="card need" data-t="7.7"><i class="ic">${IC.home}</i><h3>أسرة ترى التقدّم</h3><p>والدان يعرفان حقيقة الأسبوع.</p></div>
      </div>
      <p class="lead" data-t="10.4">وكثيرٌ من الطلاب يفتقد واحدًا منها على الأقل.</p>
    </div>` },

  { id: 'three', html: `
    <div class="pad col" style="gap:20px">
      <div><div class="eyebrow" data-t="0.1">رتّل معي</div><h1 class="big" data-t="0.3">تطبيقٌ واحد مجاني. <em>لثلاثة أطراف.</em></h1></div>
      <div class="hub">
        <svg class="hub-lines" viewBox="0 0 1600 640"><path d="M800 330 L1270 150" data-t="4.8" data-fx="draw"/><path d="M800 330 L330 150" data-t="5.4" data-fx="draw"/><path d="M800 330 L800 560" data-t="6.4" data-fx="draw"/></svg>
        <div class="hub-core" data-t="0.6" data-fx="scale"><img src="img/icon-512.png" alt=""></div>
        <div class="card node n2" data-t="5.2"><i class="ic">${IC.user}</i><div><h3>الطالب</h3><p>خطة يومية، استماع وتسميع، وكل خطأ أمام عينيه.</p></div></div>
        <div class="card node n1" data-t="5.8"><i class="ic">${IC.ear}</i><div><h3>المعلّم</h3><p>موثَّق، بلغة الطالب، يدرّس مباشرةً عبر الإنترنت.</p></div></div>
        <div class="card node n3" data-t="6.7"><i class="ic">${IC.home}</i><div><h3>الوالدان</h3><p>تقارير أسبوعية وشهرية بالبريد الإلكتروني.</p></div></div>
      </div>
    </div>` },

  { id: 'journey', deckOnly: true, html: `
    <div class="pad col" style="gap:30px">
      <div><div class="eyebrow" data-t="0.1">كيف يعمل</div><h1 class="big" data-t="0.3">من أول تسجيل <em>إلى تقريرٍ في البيت</em>.</h1></div>
      <div class="journey">
        <svg class="j-path" viewBox="0 0 1620 560"><path d="M100 120 H1520 C1770 120 1770 400 1520 400 H100" data-t="0.9" data-fx="draw" data-d="5.5"/></svg>
        ${[
          ['الدخول بحساب Google', 'طالبًا أو معلّمًا، في تطبيق واحد'],
          ['خطة يومية', 'نصف صفحة، أو صفحة، أو صفحتان'],
          ['الاستماع', `مصحف المدينة، ${AR(34)} قارئًا`],
          ['التسميع من الحفظ', 'متابعة كل كلمة'],
          ['معلّم مناسب', 'موثَّق، ويتحدث لغتك'],
          ['دروس مباشرة', 'تصحيح التطبيق والمعلّم'],
          ['عبادة اليوم', 'أذكار، أدعية، صلاة، قبلة'],
          ['اطّلاع الوالدين', 'بريد أسبوعي وشهري'],
        ].map(([h, p], i) => `<div class="j-node j${i}" data-t="${1.0 + i * 0.6}" data-fx="scale"><b>${AR(i + 1)}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}
      </div>
    </div>` },

  { id: 'plan', html: `
    <div class="split">
      <div class="col" style="gap:34px;max-width:900px">
        <div><div class="eyebrow" data-t="0.1">الخطة اليومية</div><h1 class="big" data-t="0.3">خطةٌ <em>تمضي معك</em>.</h1></div>
        <div class="col" style="gap:18px">
          <div class="card row-card" data-t="3.7" data-fx="left"><b class="dot" style="background:var(--mint)"></b><div><h3>الحفظ الجديد</h3><p>مقطع اليوم الجديد للحفظ.</p></div></div>
          <div class="card row-card" data-t="6.2" data-fx="left"><b class="dot" style="background:var(--ivory)"></b><div><h3>المراجعة القريبة</h3><p>ما حُفظ في الأيام الأخيرة.</p></div></div>
          <div class="card row-card" data-t="9.7" data-fx="left"><b class="dot" style="background:var(--gold)"></b><div><h3>المراجعة البعيدة</h3><p>دورةٌ على كل ما سبق حفظه.</p></div></div>
        </div>
        <div class="pills" data-t="15.8"><span class="pill">نصف صفحة يوميًا</span><span class="pill on">صفحة يوميًا</span><span class="pill">صفحتان يوميًا</span><span class="pill ghost">البداية من جزء عمّ أو من الفاتحة</span></div>
      </div>
      ${phone('today', 'data-t="0.8" data-fx="right"')}
    </div>` },

  { id: 'listen', html: `
    <div class="split rev">
      ${phone('mushaf1', 'data-t="0.4" data-fx="left"')}
      <div class="col" style="gap:30px;max-width:900px">
        <div><div class="eyebrow" data-t="0.1">الاستماع أولًا</div><h1 class="big" data-t="0.3">مصحف المدينة، <em>آيةً آية</em>.</h1></div>
        <div class="card quran-line" data-t="1.9"><span class="quran" lang="ar" dir="rtl">${FATIHA2.map((w, i) => `<span class="hw" data-h="${i}">${w}</span>`).join(' ')} <span class="am2">۝${AR(2)}</span></span></div>
        <div class="row" style="gap:26px;align-items:flex-end"><b class="stat" data-t="8.4" data-fx="count" data-to="34" data-d="1.0">٠</b><span class="lead" data-t="8.6" style="padding-bottom:16px">قارئًا من كبار القرّاء، منهم أئمة الحرمين الشريفين</span></div>
        <div class="pills small" data-stagger="11.3">${['عبد الرحمن السديس', 'سعود الشريم', 'ماهر المعيقلي', 'ياسر الدوسري', 'محمود خليل الحصري', 'محمد صديق المنشاوي', 'عبد الباسط عبد الصمد', 'مشاري العفاسي'].map((n) => `<span class="pill">${n}</span>`).join('')}</div>
        <div class="loop" data-t="13.8"><span class="loop-ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27"/><circle class="arc" cx="32" cy="32" r="27"/></svg><b id="loopN">١</b></span><span class="lead">تكرّر المقطع خمس مرات، حتى يستقرّ في القلب.</span></div>
      </div>
    </div>` },

  { id: 'recite', html: `
    <div class="pad col" style="gap:34px">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div><div class="eyebrow" data-t="0.1">التسميع من الحفظ</div><h1 class="big" data-t="0.3">التطبيق يتابع <em>كل كلمة</em>.</h1></div>
        <div class="listening" data-t="0.9" data-fx="fade"><span class="mic">${IC.mic}</span><span>يستمع · <b id="wcount">٠</b> من ${AR(15)} كلمة</span></div>
      </div>
      <div class="recite-wrap">
        <div class="card recite-card" data-t="0.7"><div class="sura-head">سُورَةُ الإِخۡلَاصِ</div><p class="quran ikhlas" lang="ar" dir="rtl">${ikhlasHtml}</p></div>
        <div class="card fix-card" id="fixCard"><div class="chip red">كلمة ساقطة · الآية ${AR(3)}</div><div class="quran fix-word" lang="ar">وَلَمْ</div><div class="row" style="gap:12px"><span class="btn">${IC.play} استمع إلى الآية</span><span class="btn outline">${IC.play} استمع إلى الكلمة</span></div></div>
      </div>
    </div>` },

  { id: 'result', html: `
    <div class="split rev">
      ${phone('recite-result', 'data-t="0.3" data-fx="left"')}
      <div class="col" style="gap:30px;max-width:860px">
        <div><div class="eyebrow" data-t="0.1">تقدّمٌ صادق</div><h1 class="big" data-t="0.3">تبلغ ${AR(90)}٪، <em>فيكتمل المقطع</em>.</h1></div>
        <div class="row" style="gap:36px;align-items:center">
          <div class="ring" data-t="0.5" data-fx="scale"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="86"/><circle class="arc" cx="100" cy="100" r="86"/></svg><b><span data-fx="count" data-to="91" data-t="0.6" data-d="1.8">٠</span>٪</b></div>
          <div class="col" style="gap:14px">
            <div class="okline" data-t="2.0">${IC.check} سُجّل في خطة اليوم</div>
            <div class="pill on big-pill" data-t="3.2">التالي: المراجعة القريبة · نحو ${AR(5)} دقائق</div>
          </div>
        </div>
        <div class="card wave-card" data-t="5.6"><span class="wave">${Array.from({ length: 48 }, (_, i) => `<i data-i="${i}"></i>`).join('')}</span><span>كل تلاوة محفوظة في سجلّك، مع ملاحظاتها.</span></div>
      </div>
    </div>` },

  { id: 'teacher', html: `
    <div class="pad col" style="gap:44px">
      <div><div class="eyebrow" data-t="0.1">معلّمون موثَّقون</div><h1 class="big" data-t="0.3">معلّمٌ حقيقي، <em>يُختبر أولًا</em>.</h1></div>
      <div class="steps">
        <svg class="steps-line" viewBox="0 0 1600 20"><path d="M120 10 H1480" data-t="5.3" data-fx="draw" data-d="7.0"/></svg>
        <div class="step" data-t="5.3"><i class="ic">${IC.user}</i><h3>التقديم</h3><p>الخبرة واللغات والإجازة</p></div>
        <div class="step" data-t="7.2"><i class="ic">${IC.mic}</i><h3>تسجيل سورة</h3><p>اختبار تلاوة داخل التطبيق</p></div>
        <div class="step" data-t="9.1"><i class="ic">${IC.ear}</i><h3>تستمع الأكاديمية</h3><p>التحقق من التلاوة والتجويد</p></div>
        <div class="step verified" data-t="12.6" data-fx="scale"><i class="ic">${IC.shield}</i><h3>موثَّق</h3><p>يمكن إسناد الطلاب إليه</p></div>
      </div>
      <div class="col" style="gap:16px">
        <div class="lead" data-t="15.6">معلّمٌ يتحدث لغة الطالب، ومعلّمٌ أو معلّمة بحسب اختيار الأسرة</div>
        <div class="pills" data-stagger="16.7">${[['العربية', ''], ['English', 'الإنجليزية'], ['اردو', 'الأردية'], ['Bahasa Melayu', 'الملايوية'], ['Bahasa Indonesia', 'الإندونيسية'], ['Türkçe', 'التركية'], ['Français', 'الفرنسية'], ['বাংলা', 'البنغالية'], ['فارسی', 'الفارسية'], ['Soomaali', 'الصومالية'], ['Kiswahili', 'السواحيلية']].map(([a, b]) => `<span class="pill"><bdi>${a}</bdi>${b ? ` <small>${b}</small>` : ''}</span>`).join('')}<span class="pill on">معلّم</span><span class="pill on">معلّمة</span></div>
      </div>
    </div>` },

  { id: 'lesson', html: `
    <div class="pad col" style="gap:28px">
      <div><div class="eyebrow" data-t="0.1">دروس مباشرة</div><h1 class="big" data-t="0.3">مع معلّمك، <em>مباشرةً عبر الإنترنت</em>.</h1></div>
      <div class="lesson">
        <div class="call card" data-t="0.8">
          <div class="vid main"><span class="av">ي</span><span class="tag">يوسف · يسمّع</span><span class="live"><i></i>مباشر</span><span class="vid-note" data-t="3.5" data-fx="fade">يراه ويسمعه مباشرةً عبر التطبيق</span></div>
          <div class="vid pip"><span class="av gold">أ</span><span class="pip-name">الأستاذ أحمد</span></div>
          <p class="quran call-words" lang="ar" dir="rtl"><span>لَمْ</span> <span class="cw" id="cwT">يَلِدْ</span> <span class="cw" id="cwA">وَلَمْ</span> <span>يُولَدْ</span> <span class="am2">۝${AR(3)}</span></p>
          <div class="two-marks">
            <div class="mk app" id="mkApp"><b>رصدها التطبيق</b><span id="mkAppState">كلمة خاطئة · بانتظار المعلّم</span></div>
            <div class="mk teacher" id="mkTeacher"><b>علّمها المعلّم</b><span>تصحيح المعلّم نفسه</span></div>
          </div>
        </div>
        <div class="card rubric" data-t="15.8">
          <h3>التقييم</h3>
          ${[['الحفظ', 38, 40], ['التجويد', 26, 30], ['مخارج الحروف', 17, 20], ['الوقف', 9, 10]].map(([l, v, m], i) => `<div class="rb"><span>${l}</span><i><b data-t="${[17.0, 17.6, 18.4, 19.6][i]}" data-fx="grow" data-w="${(v / m) * 100}"></b></i><em>${AR(v)}/${AR(m)}</em></div>`).join('')}
          <div class="total" data-t="20.4"><span>المجموع</span><b><span data-fx="count" data-to="90" data-t="20.4" data-d="1.2">٠</span>/${AR(100)}</b></div>
          <div class="row" style="gap:14px" data-t="21.5"><span class="btn pass" id="passBtn">${IC.check} اجتياز · يُفتح الدرس التالي</span><span class="btn outline">إعادة</span></div>
        </div>
      </div>
    </div>` },

  { id: 'parents', html: `
    <div class="split">
      <div class="col" style="gap:30px;max-width:760px">
        <div><div class="eyebrow" data-t="0.1">للوالدين</div><h1 class="big" data-t="0.3">قريبون من التقدّم، <em>دون تسجيل دخول</em>.</h1></div>
        <div class="col" style="gap:16px">
          <div class="card row-card" data-t="5.0" data-fx="left"><i class="ic sm">${IC.cal}</i><div><h3>كل يوم أحد</h3><p>التقرير الأسبوعي</p></div></div>
          <div class="card row-card" data-t="6.5" data-fx="left"><i class="ic sm">${IC.mail}</i><div><h3>أول كل شهر</h3><p>التقرير الشهري</p></div></div>
        </div>
        <div class="col" style="gap:10px">
          <div class="okline" data-t="21.3">${IC.check} لا يُرسَل شيء قبل موافقة أحد الوالدين</div>
          <div class="okline" data-t="24.8">${IC.check} إيقافه بلمسة واحدة، في أي وقت</div>
        </div>
      </div>
      <div class="email" data-t="1.0" data-fx="right">
        <div class="em-brand">رتّل معي <span lang="en" dir="ltr">Recite With Me</span></div>
        <div class="em-card">
          <div class="em-eyebrow">التقرير الأسبوعي · ${AR(25)} – ${AR(31)} أكتوبر ${AR(2026)}</div>
          <h2>يوسف علي</h2>
          <p>سمّع يوسف ${AR(9)} مرات في ${AR(6)} أيام من ${AR(7)}، وحفظ صفحة جديدة، وقيّمه المعلّم مرتين بمتوسط ${AR(92)} من ${AR(100)}.</p>
          <div class="em-grid">
            <div data-t="11.2" data-fx="scale"><b>${AR(6)}/${AR(7)}</b><span>أيام المواظبة</span></div>
            <div data-t="12.5" data-fx="scale"><b>${AR(1)}</b><span>صفحات جديدة</span></div>
            <div data-t="13.1" data-fx="scale"><b>${AR(92)}</b><span>تقييم المعلّم</span></div>
          </div>
          <div class="em-mistakes" data-t="13.9"><b>الأخطاء:</b><span class="em-chip app">رصدها التطبيق · ${AR(3)}</span><span class="em-chip teacher">علّمها المعلّم · ${AR(2)}</span></div>
          <div class="em-h" data-t="16.9">ملاحظات المعلّم</div>
          <div class="em-fb" data-t="17.1"><b>${AR(92)}/${AR(100)} · اجتياز</b> · الأستاذ أحمد<p>«ما شاء الله، أسبوعٌ موفّق. راجِع الآية الثالثة قبل الخميس.»</p></div>
          <div class="em-h" data-t="18.6">كلمات للمراجعة</div>
          <div class="em-word" data-t="18.8"><span class="quran" lang="ar">ٱلصَّمَدُ</span><span>الإخلاص: ${AR(2)}</span><b>مرتان</b></div>
        </div>
      </div>
    </div>` },

  { id: 'worship', html: `
    <div class="pad col" style="gap:50px">
      <div><div class="eyebrow" data-t="0.1">من حول الدرس</div><h1 class="big" data-t="0.3">يومٌ <em>موصولٌ بالله</em>.</h1></div>
      <div class="cards3">
        <div class="card wcard" data-t="3.3"><div class="counter"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52"/></svg><b id="dhikrN">٠/٣</b></div><h3>الأذكار</h3><p>الصباح والمساء، وبعد الصلاة وقبل النوم، مع عدّاد.</p></div>
        <div class="card wcard" data-t="5.9"><p class="quran dua" lang="ar" dir="rtl">بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ</p><h3>الأدعية والرقية</h3><p>مكتبة من «حصن المسلم»، مع مصدر كل دعاء.</p></div>
        <div class="card wcard" data-t="8.2"><div class="compass"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><path d="M60 12v8M60 100v8M12 60h8M100 60h8"/><g id="needle"><path d="M60 22 67 60 60 66 53 60z" class="n1"/><path d="M60 98 53 60 60 54 67 60z" class="n2"/></g></svg></div><h3>مواقيت الصلاة والقبلة</h3><p>لمدينتك، وفق طرق حساب معتمدة.</p></div>
      </div>
    </div>` },

  { id: 'sources', html: `
    <div class="pad col" style="gap:40px">
      <div><div class="eyebrow" data-t="0.1">المصادر</div><h1 class="big" data-t="0.3">قائمٌ على <em>مصادر موثوقة</em>.</h1></div>
      <div class="grid2">
        <div class="card src" data-t="3.2"><i class="ic">${IC.book}</i><div><h3>نص القرآن الكريم</h3><p>مصحف المدينة النبوية بالرسم العثماني، برواية حفص عن عاصم.</p></div></div>
        <div class="card src" data-t="8.1"><i class="ic">${IC.star}</i><div><h3>الأذكار والأدعية</h3><p>من «حصن المسلم»، مع تخريج كل حديث: البخاري ومسلم وأبو داود والترمذي.</p></div></div>
        <div class="card src" data-t="16.1"><i class="ic">${IC.shield}</i><div><h3>الأدعية القرآنية</h3><p>مأخوذة من نص المصحف نفسه مع تلاوتها، ولا تُعاد كتابتها.</p></div></div>
        <div class="card src" data-t="18.6"><i class="ic">${IC.ear}</i><div><h3>التلاوات ومواقيت الصلاة</h3><p>${AR(34)} قارئًا من كبار القرّاء. والمواقيت وفق أم القرى، ورابطة العالم الإسلامي، والهيئة المصرية، و<bdi>ISNA</bdi>، وغيرها.</p></div></div>
      </div>
    </div>` },

  { id: 'principles', html: `
    <div class="pad col" style="gap:40px">
      <div><div class="eyebrow" data-t="0.1">المبادئ</div><h1 class="big" data-t="0.3">مبادئ <em>واضحة</em>.</h1></div>
      <div class="grid2">
        <div class="card src" data-t="1.8"><i class="ic">${IC.scale}</i><div><h3>الكلمة الأخيرة للمعلّم</h3><p>التقنية تتحقق من الكلمات، والمعلّم يحكم في التجويد، ويؤكّد كل خطأ، ويقرّر الاجتياز أو الإعادة.</p></div></div>
        <div class="card src" data-t="9.5"><i class="ic">${IC.lock}</i><div><h3>الخصوصية أولًا</h3><p>التسجيلات لا يراها إلا الطالب ومعلّمه، ولا تصل التقارير إلى الوالدين إلا بعد موافقتهم.</p></div></div>
        <div class="card src" data-t="11.1"><i class="ic">${IC.people}</i><div><h3>الأسرة تختار</h3><p>معلّمًا أو معلّمة، بلغة البيت.</p></div></div>
        <div class="card src" data-t="12.9"><i class="ic">${IC.gift}</i><div><h3>مجاني، بلا إعلانات</h3><p>لا شيء يَشغَل عن القرآن.</p></div></div>
      </div>
    </div>` },

  { id: 'close', html: `
    <div class="center col" style="gap:28px">
      <img class="logo-mark" src="img/icon-512.png" alt="" data-t="0.2" data-fx="scale">
      <div class="ar-brand" data-t="0.4">رتّل معي <small lang="en" dir="ltr">Recite With Me</small></div>
      <div class="close-lines"><p data-t="1.1">احفظ بإتقان.</p><p data-t="2.8">وراجع بانتظام.</p><p data-t="4.4"><em>ورتّل مع معلّمك.</em></p></div>
      <div class="row" style="gap:18px" data-t="6.2"><span class="pill cta" dir="ltr">rattilmai.com</span><span class="pill ghost">للمعلّمين: <bdi>rattilmai.com/teach</bdi></span></div>
    </div>` },
];

// ---------- timing helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const prog = (t, start, dur = 0.7) => ease((t - start) / dur);

// Scene-specific motion, timed to the Arabic narration.
export const FX = {
  recite(el, t) {
    const start = 2.0, step = 0.36, skip = 8;
    const n = Math.floor((t - start) / step);
    el.querySelectorAll('.aw').forEach((w, i) => {
      const done = n > i || (i === skip && n > skip);
      w.classList.toggle('on', done && i !== skip);
      w.classList.toggle('now', n === i && i !== skip);
      w.classList.toggle('bad', i === skip && n > skip);
    });
    const wc = el.querySelector('#wcount'); if (wc) wc.textContent = AR(Math.max(0, Math.min(15, n)));
    const fix = el.querySelector('#fixCard');
    const tf = start + step * (skip + 1.5);
    const p = prog(t, tf, 0.6);
    fix.style.opacity = p; fix.style.transform = `translateY(${(1 - p) * 30}px)`;
    fix.querySelector('.btn').classList.toggle('pulse', t > 8.4 && t < 11.5);
    const mic = el.querySelector('.mic');
    if (mic) mic.style.boxShadow = `0 0 0 ${8 + 8 * Math.abs(Math.sin(t * 3))}px rgba(127,211,168,.18)`;
  },
  listen(el, t) {
    const L0 = 5.5;
    const k = Math.floor((t - L0) / 0.55) % 6;
    el.querySelectorAll('.hw').forEach((h, i) => h.classList.toggle('lit', t > L0 && k === i));
    const loopT = t - 14.4;
    const arc = el.querySelector('.loop .arc');
    const nEl = el.querySelector('#loopN');
    if (arc) {
      const per = 0.7, i = clamp(Math.floor(loopT / per), 0, 4);
      const f = loopT < 0 ? 0 : (i >= 4 && loopT > 5 * per) ? 1 : (loopT % per) / per;
      arc.style.strokeDashoffset = String(170 * (1 - f));
      nEl.textContent = `${AR(loopT < 0 ? 1 : i + 1)}×`;
    }
  },
  result(el, t) {
    el.querySelector('.ring .arc').style.strokeDashoffset = String(540 * (1 - 0.91 * prog(t, 1.0, 2.2)));
    el.querySelectorAll('.wave i').forEach((b, i) => {
      b.style.height = `${10 + 34 * Math.abs(Math.sin(i * 0.9 + t * 2.4)) * Math.abs(Math.cos(i * 0.31))}px`;
    });
  },
  lesson(el, t) {
    const A = 9.6, C = 12.5, T = 14.1;
    const cwA = el.querySelector('#cwA'), cwT = el.querySelector('#cwT');
    cwA.classList.toggle('sug', t > A && t < C);
    cwA.classList.toggle('bad', t >= C);
    cwT.classList.toggle('tmark', t >= T);
    const pa = prog(t, A, 0.5), pt = prog(t, T, 0.5);
    const mA = el.querySelector('#mkApp'), mT = el.querySelector('#mkTeacher');
    mA.style.opacity = pa; mA.style.transform = `translateY(${(1 - pa) * 14}px)`;
    mT.style.opacity = pt; mT.style.transform = `translateY(${(1 - pt) * 14}px)`;
    el.querySelector('#mkAppState').textContent = t >= C ? 'كلمة خاطئة · أكّدها المعلّم' : 'كلمة خاطئة · بانتظار المعلّم';
    mA.classList.toggle('confirmed', t >= C);
    el.querySelector('#passBtn').classList.toggle('glow', t > 22.4);
  },
  worship(el, t) {
    const D0 = 3.8;
    const n = clamp(Math.floor((t - D0) / 0.6) + 1, 0, 3);
    const v = t < D0 ? 0 : n;
    el.querySelector('#dhikrN').textContent = `${AR(v)}/${AR(3)}`;
    el.querySelector('.counter .arc').style.strokeDashoffset = String(327 * (1 - v / 3));
    const Q = 10.3;
    const ang = -40 + 298 * ease((t - Q) / 1.6) + (t > Q + 1.6 ? Math.sin((t - Q - 1.6) * 2) * 3 * Math.exp(-(t - Q - 1.6)) : 0);
    el.querySelector('#needle').setAttribute('transform', `rotate(${ang} 60 60)`);
  },
};

// Apply every data-t element in a scene at local time t. Horizontal motion is mirrored for right-to-left.
export function paintScene(el, id, t) {
  el.querySelectorAll('[data-t]').forEach((n) => {
    const s = +n.dataset.t, d = +(n.dataset.d || 0.7), fx = n.dataset.fx || 'rise';
    const p = prog(t, s, d);
    if (fx === 'count') { n.textContent = AR(Math.round((+n.dataset.to) * p)); return; }
    if (fx === 'draw') { const L = n.getTotalLength ? Math.ceil(n.getTotalLength()) : 2000; n.style.strokeDasharray = String(L); n.style.strokeDashoffset = String(L * (1 - p)); return; }
    if (fx === 'grow') { n.style.width = `${(+n.dataset.w) * p}%`; return; }
    n.style.opacity = String(p);
    n.style.transform = fx === 'scale' ? `scale(${0.9 + 0.1 * p})`
      : fx === 'left' ? `translateX(${(1 - p) * 60}px)`
      : fx === 'right' ? `translateX(${-(1 - p) * 60}px)`
      : fx === 'fade' ? 'none' : `translateY(${(1 - p) * 28}px)`;
  });
  el.querySelectorAll('[data-stagger]').forEach((g) => {
    const s = +g.dataset.stagger;
    [...g.children].forEach((c, i) => { const p = prog(t, s + i * 0.22, 0.5); c.style.opacity = String(p); c.style.transform = `translateY(${(1 - p) * 16}px)`; });
  });
  el.querySelectorAll('.phone').forEach((p) => { p.style.setProperty('--float', `${Math.sin(t * 0.8) * 6}px`); });
  if (FX[id]) FX[id](el, t);
}
