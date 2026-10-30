// Chapter buttons for the film (seconds into the video).
const CH = [[0, 'Introduction'], [12, 'The challenge'], [24.7, 'One app, three people'], [31.8, 'The daily plan'], [48.8, 'Listen'], [63.9, 'Recite from memory'], [75.3, 'Honest progress'], [82.9, 'Verified teachers'], [99.8, 'Live online lessons'], [126, 'Reports for parents'], [148.4, 'Daily worship'], [159.4, 'Sources'], [178.5, 'Principles'], [193, 'Start today']];
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
