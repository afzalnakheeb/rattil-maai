// Daily adhkar. Wording and counts follow Hisn al-Muslim; to be reviewed by the academic lead.
// Quranic items are loaded from the Mushaf text so they match it exactly, with audio.

export const SETS = [
  { id: 'morning', label: 'Morning', note: 'After Fajr until sunrise' },
  { id: 'evening', label: 'Evening', note: 'After Asr until Maghrib' },
  { id: 'prayer', label: 'After prayer', note: 'After each obligatory prayer' },
  { id: 'sleep', label: 'Before sleep', note: 'At night, before sleeping' },
];

const KURSI = { id: 'kursi', title: 'Ayat al-Kursi', quran: { surah: 2, from: 255, to: 255 }, count: 1, meaning: 'The greatest verse of the Quran: Allah, the Ever-Living, the Sustainer of all.', source: 'al-Baqarah 2:255 · an-Nasa\'i (al-Kubra)' };
const IKHLAS = (n) => ({ id: 'ikhlas', title: 'Surah al-Ikhlas', quran: { surah: 112, from: 1, to: 4 }, count: n, basmala: true, meaning: 'Say: He is Allah, the One.', source: 'Abu Dawud, at-Tirmidhi' });
const FALAQ = (n) => ({ id: 'falaq', title: 'Surah al-Falaq', quran: { surah: 113, from: 1, to: 5 }, count: n, basmala: true, meaning: 'Say: I seek refuge in the Lord of daybreak.', source: 'Abu Dawud, at-Tirmidhi' });
const NAS = (n) => ({ id: 'nas', title: 'Surah an-Nas', quran: { surah: 114, from: 1, to: 6 }, count: n, basmala: true, meaning: 'Say: I seek refuge in the Lord of mankind.', source: 'Abu Dawud, at-Tirmidhi' });

const SAYYID = {
  id: 'sayyid', title: 'Sayyid al-Istighfar', count: 1,
  text: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
  meaning: 'O Allah, You are my Lord; none has the right to be worshipped but You. You created me and I am Your servant… forgive me, for none forgives sins but You.',
  source: 'al-Bukhari',
};
const BISMILLAH_LA_YADURR = {
  id: 'layadurr', title: 'In the name of Allah…', count: 3,
  text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ',
  meaning: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing.',
  source: 'Abu Dawud, at-Tirmidhi',
};
const RADITU = {
  id: 'raditu', title: 'I am pleased with Allah…', count: 3,
  text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا',
  meaning: 'I am pleased with Allah as my Lord, Islam as my religion and Muhammad ﷺ as my Prophet.',
  source: 'Abu Dawud, at-Tirmidhi',
};
const HASBIYA = {
  id: 'hasbiya', title: 'Allah is sufficient for me', count: 7,
  text: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
  meaning: 'Allah is sufficient for me; none has the right to be worshipped but Him. In Him I trust, and He is the Lord of the Mighty Throne.',
  source: 'Abu Dawud',
};
const SUBHAN_100 = {
  id: 'subhan100', title: 'Glory and praise be to Allah', count: 100,
  text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
  meaning: 'Glory be to Allah and praise be to Him.',
  source: 'Muslim',
};
const TAHLIL_10 = {
  id: 'tahlil10', title: 'There is no god but Allah…', count: 10,
  text: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
  meaning: 'None has the right to be worshipped but Allah alone, without partner. His is the dominion and His is the praise, and He is over all things capable.',
  source: 'an-Nasa\'i, Ahmad',
};
const AUDHU_EVENING = {
  id: 'audhu', title: 'I seek refuge in the perfect words…', count: 3,
  text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
  meaning: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
  source: 'Muslim',
};

export const ADHKAR = {
  morning: [KURSI, IKHLAS(3), FALAQ(3), NAS(3), SAYYID, RADITU, BISMILLAH_LA_YADURR, HASBIYA, TAHLIL_10, SUBHAN_100],
  evening: [KURSI, IKHLAS(3), FALAQ(3), NAS(3), SAYYID, RADITU, BISMILLAH_LA_YADURR, AUDHU_EVENING, HASBIYA, SUBHAN_100],
  prayer: [
    { id: 'istighfar', title: 'I seek forgiveness', count: 3, text: 'أَسْتَغْفِرُ اللَّهَ', meaning: 'I seek the forgiveness of Allah.', source: 'Muslim' },
    { id: 'salam', title: 'You are as-Salam', count: 1, text: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ', meaning: 'O Allah, You are Peace and from You is peace. Blessed are You, Possessor of majesty and honour.', source: 'Muslim' },
    { id: 'subhanallah', title: 'SubhanAllah', count: 33, text: 'سُبْحَانَ اللَّهِ', meaning: 'Glory be to Allah.', source: 'Muslim' },
    { id: 'alhamdulillah', title: 'Alhamdulillah', count: 33, text: 'الْحَمْدُ لِلَّهِ', meaning: 'All praise is for Allah.', source: 'Muslim' },
    { id: 'allahuakbar', title: 'Allahu Akbar', count: 33, text: 'اللَّهُ أَكْبَرُ', meaning: 'Allah is the Greatest.', source: 'Muslim' },
    { id: 'tahlil1', title: 'Completing the hundred', count: 1, text: TAHLIL_10.text, meaning: TAHLIL_10.meaning, source: 'Muslim' },
    KURSI,
  ],
  sleep: [
    KURSI, IKHLAS(3), FALAQ(3), NAS(3),
    { id: 'bismika', title: 'In Your name, O Allah', count: 1, text: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', meaning: 'In Your name, O Allah, I die and I live.', source: 'al-Bukhari' },
    { id: 'tasbih33', title: 'SubhanAllah', count: 33, text: 'سُبْحَانَ اللَّهِ', meaning: 'Glory be to Allah.', source: 'al-Bukhari, Muslim' },
    { id: 'tahmid33', title: 'Alhamdulillah', count: 33, text: 'الْحَمْدُ لِلَّهِ', meaning: 'All praise is for Allah.', source: 'al-Bukhari, Muslim' },
    { id: 'takbir34', title: 'Allahu Akbar', count: 34, text: 'اللَّهُ أَكْبَرُ', meaning: 'Allah is the Greatest.', source: 'al-Bukhari, Muslim' },
  ],
};
