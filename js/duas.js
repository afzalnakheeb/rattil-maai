// Duas and Ruqyah library (Hisn al-Muslim selection).
// Quranic items are references only ({ surah, from, to }); their text and audio come from the
// Madinah Mushaf via the API, never typed here. Hadith duas carry `arabic` with full tashkeel,
// our own concise English meaning, and a source reference.
// Whole module is pending review by the academic lead.

export const reviewed = false;
export const REVIEW_NOTE = 'Texts are pending review by our academic lead.';
export const RUQYAH_NOTE = 'Ruqyah is recited by the person themselves or by a trustworthy reciter, with tawakkul (reliance) on Allah alone. It does not replace medical treatment: seek both.';

// ---- helpers ----
const ref = (s, a, b) => `Quran ${s}:${a}${b > a ? `–${b}` : ''}`;
const Q = (id, title, [surah, from, to = from], meaning, extra = {}) => ({
  id, title, quran: { surah, from, to }, count: 1, meaning,
  ...extra,
  source: extra.source ? `${ref(surah, from, to)} · ${extra.source}` : ref(surah, from, to),
});
const H = (id, title, arabic, meaning, source, extra = {}) => ({ id, title, arabic, meaning, source, count: 1, ...extra });

// ---- shared items ----
const FATIHAH = Q('fatihah', 'Surah al-Fatihah', [1, 1, 7], 'The Opening: praise of Allah, Lord of the worlds, and a plea for guidance to the straight path.', { source: 'al-Bukhari 5736', note: 'A Companion recited it over a man stung by a scorpion, and the Prophet ﷺ asked: "How did you know it is a ruqyah?"' });
const KURSI = Q('kursi', 'Ayat al-Kursi', [2, 255], 'Allah, the Ever-Living, the Sustainer of all; His Throne extends over the heavens and the earth.');
const BAQARAH_END = Q('baqarah-end', 'Last two ayahs of al-Baqarah', [2, 285, 286], 'The faith of the Messenger and the believers, and their plea: do not burden us beyond what we can bear.', { source: 'al-Bukhari 5009' });
const IKHLAS = Q('ikhlas', 'Surah al-Ikhlas', [112, 1, 4], 'Say: He is Allah, the One, the Self-Sufficient; He neither begets nor was begotten.', { count: 3, source: 'al-Bukhari 5017' });
const FALAQ = Q('falaq', 'Surah al-Falaq', [113, 1, 5], 'Say: I seek refuge in the Lord of daybreak from the evil of what He created, of sorcery and of envy.', { count: 3, source: 'al-Bukhari 5017' });
const NAS = Q('nas', 'Surah an-Nas', [114, 1, 6], 'Say: I seek refuge in the Lord of mankind from the whispering one who withdraws.', { count: 3, source: 'al-Bukhari 5017' });

const ASALU = H('asalu', 'I ask Allah the Mighty to cure you',
  'أَسْأَلُ اللَّهَ الْعَظِيمَ رَبَّ الْعَرْشِ الْعَظِيمِ أَنْ يَشْفِيَكَ',
  'I ask Allah the Mighty, Lord of the Mighty Throne, to cure you.',
  'Abu Dawud 3106, at-Tirmidhi 2083', { count: 7, note: 'Said seven times for a sick person.' });
const ARQIKA = H('arqika', 'In the name of Allah I recite over you',
  'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللَّهُ يَشْفِيكَ، بِسْمِ اللَّهِ أَرْقِيكَ',
  'In the name of Allah I recite ruqyah over you, from everything that harms you, from the evil of every soul or envious eye. May Allah cure you. In the name of Allah I recite ruqyah over you.',
  'Muslim 2186', { note: 'The ruqyah Jibril recited over the Prophet ﷺ. Muslim\'s text spells it «بِاسْمِ اللَّهِ»; the pronunciation is the same.' });
const RABB_NAS = H('rabb-nas', 'O Allah, Lord of mankind, remove the harm',
  'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
  'O Allah, Lord of mankind, remove the harm and heal; You are the Healer. There is no healing but Your healing, a healing that leaves no illness behind.',
  'al-Bukhari 5743, Muslim 2191', { note: 'The Prophet ﷺ wiped the sick person with his right hand while saying it. Wording differs slightly between narrations.' });
const KALIMAT = H('kalimat', 'I seek refuge in the perfect words of Allah',
  'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
  'I seek refuge in the perfect words of Allah from every devil and every venomous creature, and from every harmful eye.',
  'al-Bukhari 3371', { note: 'The Prophet ﷺ sought refuge for al-Hasan and al-Husayn with «أُعِيذُكُمَا…»; said as «أَعُوذُ…» for oneself.' });
const PAIN_BISM = H('pain-bism', 'For pain: In the name of Allah',
  'بِسْمِ اللَّهِ',
  'In the name of Allah.',
  'Muslim 2202', { count: 3, note: 'Place your hand on the place of pain and say it three times, then the next dua seven times.' });
const PAIN_AUDHU = H('pain-audhu', 'For pain: I seek refuge in Allah and His power',
  'أَعُوذُ بِاللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
  'I seek refuge in Allah and His power from the evil of what I feel and what I fear.',
  'Muslim 2202', { count: 7, note: 'With your hand still on the place of pain.' });

const RUQYAH_DUAS = [ASALU, ARQIKA, RABB_NAS, KALIMAT, PAIN_BISM, PAIN_AUDHU];

const SHORT = [FATIHAH, KURSI, BAQARAH_END, IKHLAS, FALAQ, NAS, ...RUQYAH_DUAS];

const FULL = [
  FATIHAH,
  Q('baqarah-1-5', 'Opening of al-Baqarah', [2, 1, 5], 'The Book in which there is no doubt, guidance for the God-conscious who believe in the unseen.'),
  Q('baqarah-102', 'Al-Baqarah 102: magic', [2, 102], 'Sorcery is disbelief taught by devils; it harms no one except by Allah\'s permission.'),
  Q('baqarah-163', 'Al-Baqarah 163–164: oneness', [2, 163, 164], 'Your God is One God; the signs of His oneness in the heavens, the earth, the night and day.'),
  KURSI,
  BAQARAH_END,
  Q('imran-18', 'Al Imran 18–19: Allah\'s witness', [3, 18, 19], 'Allah bears witness that there is no god but He; the religion before Allah is Islam.'),
  Q('araf-54', 'Al-A\'raf 54–56: the Creator', [7, 54, 56], 'Your Lord created the heavens and earth; call on Him humbly, in fear and hope.'),
  Q('araf-117', 'Al-A\'raf 117–122: Musa\'s staff', [7, 117, 122], 'The staff of Musa swallows the magicians\' deception; truth is established and falsehood undone.'),
  Q('yunus-79', 'Yunus 79–82: magic undone', [10, 79, 82], 'What you have brought is sorcery; Allah will surely nullify it. He does not set right the work of corrupters.'),
  Q('taha-65', 'Ta-Ha 65–70: the magician fails', [20, 65, 70], 'The magician will not succeed wherever he comes; the magicians fall down in prostration.'),
  Q('muminun-115', 'Al-Mu\'minun 115–118: not in vain', [23, 115, 118], 'You were not created without purpose; Allah is the True King. My Lord, forgive and have mercy.'),
  Q('saffat-1', 'As-Saffat 1–10: guarded heavens', [37, 1, 10], 'The heavens are adorned and guarded against every rebellious devil.'),
  Q('ahqaf-29', 'Al-Ahqaf 29–32: the jinn listen', [46, 29, 32], 'A company of jinn listened to the Quran and returned to warn their people.'),
  Q('rahman-33', 'Ar-Rahman 33–36: no escape', [55, 33, 36], 'Jinn and mankind cannot pass beyond the regions of the heavens and earth except by His authority.'),
  Q('hashr-21', 'Al-Hashr 21–24: the Names', [59, 21, 24], 'Had this Quran come down on a mountain it would humble itself; the most beautiful Names of Allah.'),
  Q('jinn-1', 'Al-Jinn 1–9: the jinn believe', [72, 1, 9], 'The jinn who heard the Quran believed and found the heavens guarded.'),
  Q('tawbah-14', 'At-Tawbah 14: healing of hearts', [9, 14], 'Shifa ayah: Allah will heal the breasts of a believing people.'),
  Q('yunus-57', 'Yunus 57: healing for the breasts', [10, 57], 'Shifa ayah: admonition from your Lord and healing for what is in the breasts.'),
  Q('nahl-69', 'An-Nahl 69: honey', [16, 69], 'Shifa ayah: from the bees comes a drink of varied colours in which there is healing for people.'),
  Q('isra-82', 'Al-Isra 82: healing and mercy', [17, 82], 'Shifa ayah: We send down in the Quran what is healing and mercy for the believers.'),
  Q('shuara-80', 'Ash-Shu\'ara 80: He heals me', [26, 80], 'Shifa ayah: Ibrahim said, "And when I fall ill, it is He who heals me."'),
  Q('fussilat-44', 'Fussilat 44: guidance and healing', [41, 44], 'Shifa ayah: say, it is guidance and healing for those who believe.'),
  IKHLAS, FALAQ, NAS,
  ...RUQYAH_DUAS,
];

// ---- library ----
const RAW = [
  {
    id: 'ruqyah-short', kind: 'ruqyah', title: 'Short Ruqyah', ar: 'الرقية المختصرة',
    note: 'The core of the Sunnah ruqyah: al-Fatihah, Ayat al-Kursi, the end of al-Baqarah, the three Quls and the Prophet\'s ﷺ duas for healing.',
    items: SHORT,
  },
  {
    id: 'ruqyah-full', kind: 'ruqyah', title: 'Full Ruqyah', ar: 'الرقية الشرعية الكاملة',
    note: 'The short ruqyah with the passages commonly recited in ruqyah: on magic, the jinn, Allah\'s oneness and the ayahs of healing.',
    items: FULL,
  },
  {
    id: 'waking', title: 'Waking up', ar: 'الاستيقاظ من النوم',
    items: [
      H('wake-ahyana', 'Praise to Allah who gave us life', 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
        'Praise is for Allah who gave us life after He had caused us to die, and to Him is the rising.', 'al-Bukhari 6312'),
      H('wake-afani', 'Praise to Allah who restored my soul', 'الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي، وَرَدَّ عَلَيَّ رُوحِي، وَأَذِنَ لِي بِذِكْرِهِ',
        'Praise is for Allah who gave my body well-being, returned my soul to me and permitted me to remember Him.', 'at-Tirmidhi 3401'),
      Q('wake-imran', 'Last ayahs of Al Imran', [3, 190, 200], 'In the creation of the heavens and earth are signs for people of understanding, who remember Allah standing, sitting and lying down.',
        { source: 'al-Bukhari 4569', note: 'The Prophet ﷺ recited them on waking for the night prayer.' }),
    ],
  },
  {
    id: 'home', title: 'Entering and leaving home', ar: 'دخول المنزل والخروج منه',
    items: [
      H('home-out-tawakkaltu', 'Leaving: I rely on Allah', 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
        'In the name of Allah, I place my trust in Allah; there is no might nor power except with Allah.', 'Abu Dawud 5095, at-Tirmidhi 3426'),
      H('home-out-adilla', 'Leaving: protection from going astray', 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ أَنْ أَضِلَّ أَوْ أُضَلَّ، أَوْ أَزِلَّ أَوْ أُزَلَّ، أَوْ أَظْلِمَ أَوْ أُظْلَمَ، أَوْ أَجْهَلَ أَوْ يُجْهَلَ عَلَيَّ',
        'O Allah, I seek refuge in You from going astray or being led astray, from slipping or being made to slip, from wronging or being wronged, and from acting foolishly or being treated foolishly.', 'Abu Dawud 5094, at-Tirmidhi 3427'),
      H('home-in-bism', 'Entering: mention Allah\'s name', 'بِسْمِ اللَّهِ',
        'In the name of Allah.', 'Muslim 2018', { note: 'When a person mentions Allah on entering and at his meal, Shaytan says: "No lodging and no supper for you."' }),
    ],
  },
  {
    id: 'masjid', title: 'Entering and leaving the masjid', ar: 'دخول المسجد والخروج منه',
    items: [
      H('masjid-audhu', 'Entering: refuge from Shaytan', 'أَعُوذُ بِاللَّهِ الْعَظِيمِ، وَبِوَجْهِهِ الْكَرِيمِ، وَسُلْطَانِهِ الْقَدِيمِ، مِنَ الشَّيْطَانِ الرَّجِيمِ',
        'I seek refuge in Allah the Mighty, in His noble Face and His eternal authority, from Shaytan the outcast.', 'Abu Dawud 466'),
      H('masjid-in', 'Entering: open the doors of Your mercy', 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
        'O Allah, open for me the doors of Your mercy.', 'Muslim 713'),
      H('masjid-out', 'Leaving: I ask You of Your bounty', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
        'O Allah, I ask You of Your bounty.', 'Muslim 713'),
    ],
  },
  {
    id: 'wudu', title: 'Wudu', ar: 'الوضوء',
    items: [
      H('wudu-before', 'Before wudu', 'بِسْمِ اللَّهِ',
        'In the name of Allah.', 'Abu Dawud 101', { note: '"There is no wudu for one who does not mention Allah\'s name over it."' }),
      H('wudu-shahada', 'After wudu: the testimony', 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
        'I bear witness that none has the right to be worshipped but Allah alone, without partner, and I bear witness that Muhammad is His servant and Messenger.', 'Muslim 234', { note: 'The eight gates of Paradise are opened for whoever says it after a complete wudu.' }),
      H('wudu-tawwabin', 'After wudu: make me of those who repent', 'اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ، وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
        'O Allah, make me among those who turn to You in repentance and among those who purify themselves.', 'at-Tirmidhi 55'),
      H('wudu-subhanaka', 'After wudu: glory be to You', 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
        'Glory and praise be to You, O Allah. I bear witness that there is no god but You; I seek Your forgiveness and turn to You.', 'an-Nasa\'i, ʿAmal al-Yawm wal-Laylah'),
    ],
  },
  {
    id: 'dressing', title: 'Getting dressed', ar: 'لبس الثوب',
    items: [
      H('dress-kasani', 'Praise to Allah who clothed me', 'الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا الثَّوْبَ، وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
        'Praise is for Allah who clothed me with this garment and provided it for me without any might or power on my part.', 'Abu Dawud 4023'),
      H('dress-new', 'Wearing new clothes', 'اللَّهُمَّ لَكَ الْحَمْدُ أَنْتَ كَسَوْتَنِيهِ، أَسْأَلُكَ مِنْ خَيْرِهِ وَخَيْرِ مَا صُنِعَ لَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّهِ وَشَرِّ مَا صُنِعَ لَهُ',
        'O Allah, praise is Yours; You clothed me with it. I ask You for its good and the good it was made for, and I seek refuge in You from its evil and the evil it was made for.', 'Abu Dawud 4020, at-Tirmidhi 1767'),
    ],
  },
  {
    id: 'eating', title: 'Eating and after eating', ar: 'الطعام',
    items: [
      H('eat-bism', 'Before eating', 'بِسْمِ اللَّهِ',
        'In the name of Allah.', 'al-Bukhari 5376', { note: '"Young man, mention Allah\'s name, eat with your right hand and eat from what is nearest to you."' }),
      H('eat-forgot', 'If you forgot at the start', 'بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ',
        'In the name of Allah, at its beginning and its end.', 'Abu Dawud 3767, at-Tirmidhi 1858'),
      H('eat-atamani', 'After eating: who fed me', 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا، وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
        'Praise is for Allah who fed me this and provided it for me without any might or power on my part.', 'at-Tirmidhi 3458, Abu Dawud 4023'),
      H('eat-kathiran', 'After eating: abundant praise', 'الْحَمْدُ لِلَّهِ كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ، غَيْرَ مَكْفِيٍّ وَلَا مُوَدَّعٍ، وَلَا مُسْتَغْنًى عَنْهُ رَبَّنَا',
        'Praise be to Allah, abundant, good and blessed praise; praise that is never enough, never abandoned and never dispensed with, our Lord.', 'al-Bukhari 5458'),
      H('eat-host', 'For the host', 'اللَّهُمَّ بَارِكْ لَهُمْ فِيمَا رَزَقْتَهُمْ، وَاغْفِرْ لَهُمْ وَارْحَمْهُمْ',
        'O Allah, bless them in what You have provided them, forgive them and have mercy on them.', 'Muslim 2042'),
    ],
  },
  {
    id: 'travel', title: 'Travel', ar: 'السفر',
    items: [
      H('travel-takbir', 'Mounting: Allahu Akbar', 'اللَّهُ أَكْبَرُ',
        'Allah is the Greatest.', 'Muslim 1342', { count: 3, note: 'Said three times once settled on the mount or vehicle, followed by the next two items.' }),
      Q('travel-subhana', 'Glory to Him who subjected this for us', [43, 13, 14], 'Glory be to Him who subjected this to us, though we could never have done it ourselves; and to our Lord we will surely return.',
        { source: 'Muslim 1342' }),
      H('travel-dua', 'The dua of travel', 'اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى، اللَّهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا وَاطْوِ عَنَّا بُعْدَهُ، اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالْخَلِيفَةُ فِي الْأَهْلِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ، وَكَآبَةِ الْمَنْظَرِ، وَسُوءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ',
        'O Allah, we ask You on this journey of ours for righteousness and piety, and deeds that please You. O Allah, make this journey easy for us and shorten its distance. O Allah, You are the Companion on the journey and the One who watches over the family. O Allah, I seek refuge in You from the hardship of travel, from a distressing sight, and from an ill return to wealth and family.',
        'Muslim 1342'),
      H('travel-return', 'Returning', 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ',
        'Returning, repenting, worshipping, and praising our Lord.', 'Muslim 1342', { note: 'Added to the dua of travel on the way home.' }),
      H('travel-stop', 'Stopping at a place', 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
        'I seek refuge in the perfect words of Allah from the evil of what He has created.', 'Muslim 2708', { note: 'Nothing will harm the one who says it until he leaves that place.' }),
    ],
  },
  {
    id: 'distress', title: 'Distress and anxiety', ar: 'الهم والحزن والكرب',
    items: [
      H('distress-hamm', 'Refuge from worry and grief', 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ، وَغَلَبَةِ الرِّجَالِ',
        'O Allah, I seek refuge in You from worry and grief, from helplessness and laziness, from miserliness and cowardice, from the burden of debt and from being overpowered by men.', 'al-Bukhari 6369'),
      Q('distress-yunus', 'The dua of Yunus', [21, 87], 'There is no god but You, glory be to You; I have been among the wrongdoers.',
        { source: 'at-Tirmidhi 3505', note: 'No Muslim calls upon Allah with it for anything without being answered.' }),
      H('distress-karb', 'The dua of distress', 'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
        'There is no god but Allah, the Mighty, the Forbearing. There is no god but Allah, Lord of the Mighty Throne. There is no god but Allah, Lord of the heavens, Lord of the earth and Lord of the Noble Throne.', 'al-Bukhari 6346'),
      H('distress-rahmataka', 'Your mercy I hope for', 'اللَّهُمَّ رَحْمَتَكَ أَرْجُو فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ، وَأَصْلِحْ لِي شَأْنِي كُلَّهُ، لَا إِلَهَ إِلَّا أَنْتَ',
        'O Allah, it is Your mercy I hope for, so do not leave me to myself even for the blink of an eye, and set right all my affairs. There is no god but You.', 'Abu Dawud 5090'),
      Q('distress-hasbuna', 'Allah is sufficient for us', [3, 173], 'Allah is sufficient for us, and He is the best Disposer of affairs.',
        { source: 'al-Bukhari 4563', note: 'Said by Ibrahim when thrown into the fire, and by the Prophet ﷺ when told the enemy had gathered.' }),
    ],
  },
  {
    id: 'forgiveness', title: 'Seeking forgiveness', ar: 'الاستغفار والتوبة',
    items: [
      H('istighfar-sayyid', 'Sayyid al-Istighfar', 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
        'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I keep Your covenant and promise as best I can. I seek refuge in You from the evil I have done. I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins but You.',
        'al-Bukhari 6306', { note: 'Whoever says it with certainty in the day and dies before evening, or at night and dies before morning, is of the people of Paradise.' }),
      H('istighfar-atubu', 'I seek Allah\'s forgiveness and repent', 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
        'I seek the forgiveness of Allah and turn to Him in repentance.', 'al-Bukhari 6307, Muslim 2702', { count: 100, note: 'The Prophet ﷺ sought forgiveness more than seventy times a day (al-Bukhari), and a hundred times (Muslim).' }),
      H('istighfar-abubakr', 'I have wronged myself greatly', 'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا، وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ، وَارْحَمْنِي، إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ',
        'O Allah, I have wronged myself greatly and none forgives sins but You, so grant me forgiveness from You and have mercy on me. You are the Forgiving, the Merciful.', 'al-Bukhari 834, Muslim 2705', { note: 'Taught to Abu Bakr to say in his prayer.' }),
    ],
  },
  {
    id: 'knowledge', title: 'Knowledge and memorizing', ar: 'طلب العلم والحفظ',
    items: [
      Q('know-zidni', 'My Lord, increase me in knowledge', [20, 114], 'Exalted is Allah, the True King… and say: My Lord, increase me in knowledge.'),
      Q('know-sharh', 'My Lord, expand my chest', [20, 25, 28], 'Musa\'s dua: my Lord, expand my chest, ease my task, and untie the knot from my tongue so they understand my speech.'),
      H('know-infani', 'Benefit me by what You taught me', 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا',
        'O Allah, benefit me by what You have taught me, teach me what will benefit me, and increase me in knowledge.', 'Ibn Majah 251'),
      H('know-nafi', 'Beneficial knowledge', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
        'O Allah, I ask You for beneficial knowledge, good provision, and deeds that are accepted.', 'Ibn Majah 925', { note: 'Said after the salam of Fajr.' }),
      H('know-la-yanfa', 'Refuge from knowledge that does not benefit', 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ، وَمِنْ قَلْبٍ لَا يَخْشَعُ، وَمِنْ نَفْسٍ لَا تَشْبَعُ، وَمِنْ دَعْوَةٍ لَا يُسْتَجَابُ لَهَا',
        'O Allah, I seek refuge in You from knowledge that does not benefit, from a heart that is not humble, from a soul that is never satisfied, and from a supplication that is not answered.', 'Muslim 2722', { note: 'The closing part of a longer dua.' }),
    ],
  },
  {
    id: 'parents', title: 'For parents', ar: 'الدعاء للوالدين',
    items: [
      Q('parents-irhamhuma', 'My Lord, have mercy on them', [17, 24], 'Lower to them the wing of humility out of mercy, and say: my Lord, have mercy on them as they raised me when I was small.'),
      Q('parents-ibrahim', 'Forgive me and my parents', [14, 41], 'Ibrahim\'s dua: our Lord, forgive me, my parents and the believers on the Day the reckoning is established.'),
      Q('parents-nuh', 'Nuh\'s dua for his parents', [71, 28], 'My Lord, forgive me, my parents, whoever enters my house as a believer, and the believing men and women.'),
      Q('parents-awzini', 'Enable me to be grateful', [46, 15], 'My Lord, enable me to be grateful for Your favour on me and my parents, to do righteous deeds that please You, and make my offspring righteous.'),
    ],
  },
  {
    id: 'sick', title: 'Visiting the sick', ar: 'عيادة المريض',
    items: [
      H('sick-tahur', 'No harm: a purification', 'لَا بَأْسَ، طَهُورٌ إِنْ شَاءَ اللَّهُ',
        'No harm; it is a purification, if Allah wills.', 'al-Bukhari 3616'),
      { ...ASALU, id: 'sick-asalu' },
      { ...RABB_NAS, id: 'sick-rabb-nas' },
    ],
  },
  {
    id: 'deceased', title: 'For the deceased', ar: 'الدعاء للميت',
    items: [
      H('janazah-ighfir', 'Janazah: forgive him and have mercy on him', 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ، وَعَافِهِ وَاعْفُ عَنْهُ، وَأَكْرِمْ نُزُلَهُ، وَوَسِّعْ مُدْخَلَهُ، وَاغْسِلْهُ بِالْمَاءِ وَالثَّلْجِ وَالْبَرَدِ، وَنَقِّهِ مِنَ الْخَطَايَا كَمَا نَقَّيْتَ الثَّوْبَ الْأَبْيَضَ مِنَ الدَّنَسِ، وَأَبْدِلْهُ دَارًا خَيْرًا مِنْ دَارِهِ، وَأَهْلًا خَيْرًا مِنْ أَهْلِهِ، وَزَوْجًا خَيْرًا مِنْ زَوْجِهِ، وَأَدْخِلْهُ الْجَنَّةَ، وَأَعِذْهُ مِنْ عَذَابِ الْقَبْرِ وَعَذَابِ النَّارِ',
        'O Allah, forgive him and have mercy on him, keep him safe and pardon him. Honour his lodging and widen his entry. Wash him with water, snow and hail, and cleanse him of sins as a white garment is cleansed of dirt. Give him a home better than his home, a family better than his family and a spouse better than his spouse. Admit him to Paradise and protect him from the punishment of the grave and of the Fire.',
        'Muslim 963', { note: 'For a woman say «لَهَا» and adjust the pronouns. One narration in Muslim ends «…أَوْ مِنْ عَذَابِ النَّارِ».' }),
      H('condolence', 'Consoling the bereaved', 'إِنَّ لِلَّهِ مَا أَخَذَ، وَلَهُ مَا أَعْطَى، وَكُلُّ شَيْءٍ عِنْدَهُ بِأَجَلٍ مُسَمًّى، فَلْتَصْبِرْ وَلْتَحْتَسِبْ',
        'To Allah belongs what He took and to Him belongs what He gave, and everything with Him has an appointed term; so be patient and hope for reward.', 'Muslim 923, al-Bukhari 1284'),
    ],
  },
  {
    id: 'rain', title: 'Rain and wind', ar: 'المطر والريح',
    items: [
      H('rain-sayyib', 'When it rains', 'اللَّهُمَّ صَيِّبًا نَافِعًا',
        'O Allah, a beneficial rain.', 'al-Bukhari 1032'),
      H('rain-after', 'After rain', 'مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ',
        'We have been given rain by the bounty and mercy of Allah.', 'al-Bukhari 846, Muslim 71'),
      H('rain-hawalayna', 'When rain is too heavy', 'اللَّهُمَّ حَوَالَيْنَا وَلَا عَلَيْنَا، اللَّهُمَّ عَلَى الْآكَامِ وَالظِّرَابِ، وَبُطُونِ الْأَوْدِيَةِ، وَمَنَابِتِ الشَّجَرِ',
        'O Allah, around us and not upon us. O Allah, on the hills and high ground, the valley beds and where the trees grow.', 'al-Bukhari 1013, Muslim 897'),
      H('wind', 'When the wind blows', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا، وَخَيْرَ مَا فِيهَا، وَخَيْرَ مَا أُرْسِلَتْ بِهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا، وَشَرِّ مَا فِيهَا، وَشَرِّ مَا أُرْسِلَتْ بِهِ',
        'O Allah, I ask You for its good, the good within it and the good it was sent with; and I seek refuge in You from its evil, the evil within it and the evil it was sent with.', 'Muslim 899'),
    ],
  },
  {
    id: 'anger', title: 'When angry', ar: 'عند الغضب',
    note: 'If standing, sit down; if anger remains, lie down (Abu Dawud 4782).',
    items: [
      H('anger-audhu', 'I seek refuge in Allah from Shaytan', 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
        'I seek refuge in Allah from Shaytan the outcast.', 'al-Bukhari 3282', { note: 'Said of a man whose face had reddened in anger: if he said this, what he feels would leave him.' }),
      Q('anger-istaidh', 'The command to seek refuge', [7, 200], 'If an evil suggestion from Shaytan provokes you, seek refuge in Allah; He is All-Hearing, All-Knowing.'),
    ],
  },
  {
    id: 'rabbana', title: 'Rabbana duas from the Quran', ar: 'أدعية ربنا من القرآن',
    items: [
      Q('rabbana-taqabbal', 'Accept from us', [2, 127], 'Ibrahim and Ismail: our Lord, accept this from us; You are the All-Hearing, the All-Knowing.'),
      Q('rabbana-atina', 'Good in this world and the next', [2, 201], 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.'),
      Q('rabbana-sabr', 'Pour patience upon us', [2, 250], 'Our Lord, pour patience upon us, make our feet firm and help us against the disbelieving people.'),
      Q('rabbana-la-tuakhidhna', 'Do not take us to task', [2, 286], 'Our Lord, do not take us to task if we forget or err, nor burden us beyond what we can bear; pardon, forgive and have mercy on us.'),
      Q('rabbana-la-tuzigh', 'Do not let our hearts deviate', [3, 8], 'Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself.'),
      Q('rabbana-amanna', 'We have believed, so forgive us', [3, 16], 'Our Lord, we have believed, so forgive us our sins and protect us from the punishment of the Fire.'),
      Q('rabbana-israf', 'Forgive our excesses', [3, 147], 'Our Lord, forgive our sins and our excesses, make our feet firm and help us against the disbelieving people.'),
      Q('rabbana-batila', 'You did not create this in vain', [3, 191, 194], 'Our Lord, You did not create this without purpose; protect us from the Fire, forgive us and do not disgrace us on the Day of Resurrection.'),
      Q('rabbana-zalamna', 'We have wronged ourselves', [7, 23], 'Adam and Hawwa: our Lord, we have wronged ourselves; if You do not forgive us and have mercy on us we will be among the losers.'),
      Q('rabbana-salah', 'Make me establish the prayer', [14, 40, 41], 'My Lord, make me and my offspring establish the prayer; our Lord, accept my dua and forgive me, my parents and the believers.'),
      Q('rabbana-kahf', 'Grant us mercy and right guidance', [18, 10], 'The youths of the cave: our Lord, grant us mercy from Yourself and set right our affair for us.'),
      Q('rabbana-qurrata', 'Comfort of our eyes', [25, 74], 'Our Lord, grant us from our spouses and offspring the comfort of our eyes, and make us leaders of the God-conscious.'),
      Q('rabbana-ikhwan', 'Forgive us and our brothers', [59, 10], 'Our Lord, forgive us and our brothers who preceded us in faith, and put no rancour in our hearts towards the believers.'),
      Q('rabbana-nur', 'Perfect our light', [66, 8], 'Our Lord, perfect our light for us and forgive us; You are over all things capable.'),
    ],
  },
];

// Item ids are made unique across the whole library: "<category>/<item>".
export const CATEGORIES = RAW.map((c) => ({
  kind: 'duas',
  ...c,
  items: c.items.map((it) => ({ ...it, id: `${c.id}/${it.id}` })),
}));

export const LIBRARY = { reviewed, categories: CATEGORIES };

export function findCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯʿʾ'’ʿ-]/g, '').toLowerCase();

// Search English titles and meanings (and category titles). Returns [{ category, item, index }].
export function searchDuas(query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  const seen = new Set();
  for (const c of CATEGORIES) {
    c.items.forEach((item, index) => {
      const hay = fold(`${item.title} ${item.meaning} ${c.title}`);
      if (!words.every((w) => hay.includes(w))) return;
      // The same dua can live in several sets; list it once, from its first set.
      const k = item.arabic || `${item.quran?.surah}:${item.quran?.from}-${item.quran?.to}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ category: c, item, index });
    });
  }
  return out;
}
