// "Email reports to parents": a student adds up to 3 parent emails. Each parent confirms
// by email first; then the weekly report arrives every Sunday morning and the monthly
// report on the 1st, in the family's time zone. Every email has a link to stop them.

import * as cloud from '../cloud.js';
import { isCloud } from '../account.js';
import { esc, toast, alive } from '../ui.js';
import { icons } from '../icons.js';

const ERR = {
  'email-not-configured': 'Email sending is being set up by the academy. Your address is saved and the confirmation will go out as soon as it is ready.',
  'too-many': 'Too many emails today for this address. Try again tomorrow.',
  'not-confirmed': 'This address has not confirmed yet.',
  'already-confirmed': 'This address is already confirmed.',
};
const errText = (e) => ERR[e?.message] || (e?.message && !/fetch|network/i.test(e.message) ? e.message : 'Could not send. Check your connection.');

export function parentEmailsSlot() {
  return isCloud() ? '<div class="card stack-s no-print" id="parentEmails"><h2>Email reports to parents</h2><div class="spinner"></div></div>' : '';
}

export async function fillParentEmails(root) {
  const box = root.querySelector('#parentEmails');
  if (!box) return;
  let list = [];
  try { list = await cloud.listReportRecipients(); } catch { box.innerHTML = '<h2>Email reports to parents</h2><p class="small muted">Not available offline.</p>'; return; }
  if (!alive(root)) return;
  const status = (r) => (r.unsubscribed_at ? '<span class="chip red">Stopped</span>' : r.confirmed_at ? '<span class="chip">Active</span>' : '<span class="chip gold">Waiting for confirmation</span>');
  box.innerHTML = `
    <h2>Email reports to parents</h2>
    <p class="small muted">A short report every Sunday morning (the past week) and on the 1st of each month (the past month): days practised, new pages, teacher grades and comments, mistakes and the words to revise. The parent confirms by email first.</p>
    ${list.map((r) => `
      <div class="list-item parent-row" data-pr="${esc(r.id)}">
        <div class="grow"><h3 style="font-size:15px">${esc(r.name || r.email)} ${status(r)}</h3>
          <div class="xs muted">${esc(r.email)}${r.last_weekly_at ? ` · last sent ${esc(new Date(r.last_weekly_at).toLocaleDateString())}` : ''}</div>
          <div class="row-wrap" style="margin-top:6px">
            <label class="pill"><input type="checkbox" data-k="weekly" ${r.weekly ? 'checked' : ''}><span>Weekly</span></label>
            <label class="pill"><input type="checkbox" data-k="monthly" ${r.monthly ? 'checked' : ''}><span>Monthly</span></label>
          </div></div>
        <div class="stack-s" style="align-items:flex-end">
          ${r.unsubscribed_at ? '<button class="btn sm outline" type="button" data-act="resume">Send again</button>'
            : r.confirmed_at ? '<button class="btn sm outline" type="button" data-act="test">Send a sample now</button>'
            : '<button class="btn sm outline" type="button" data-act="confirm">Resend confirmation</button>'}
          <button class="btn ghost sm" type="button" data-act="remove" aria-label="Remove ${esc(r.email)}">${icons.trash || '×'} Remove</button>
        </div>
      </div>`).join('')}
    ${list.length < 3 ? `<form class="stack-s" id="addParent">
      <div class="row-wrap">
        <div class="field" style="flex:2 1 220px"><label for="peEmail">Parent's email</label><input class="input" id="peEmail" type="email" required autocomplete="email" placeholder="parent@example.com" maxlength="200"></div>
        <div class="field" style="flex:1 1 140px"><label for="peName">Name (optional)</label><input class="input" id="peName" maxlength="60" placeholder="Mum, Dad, …"></div>
      </div>
      <button class="btn" type="submit" style="align-self:flex-start">${icons.plus || '+'} Add and send confirmation</button>
    </form>` : '<p class="xs muted">Up to 3 parent emails.</p>'}`;

  const refresh = () => fillParentEmails(root);
  box.querySelector('#addParent')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const row = await cloud.addReportRecipient({ email: box.querySelector('#peEmail').value, name: box.querySelector('#peName').value });
      try { await cloud.reportEmail('confirm', row.id); toast('Confirmation email sent. Ask the parent to tap “Yes, send me the reports”.'); } catch (x) { toast(errText(x)); }
    } catch (x) {
      toast(/duplicate|unique/i.test(x?.message || '') ? 'This email is already added.' : errText(x));
    }
    refresh();
  });
  box.querySelectorAll('[data-pr]').forEach((row) => {
    const id = row.dataset.pr;
    row.querySelectorAll('[data-k]').forEach((c) => c.addEventListener('change', async () => {
      try { await cloud.updateReportRecipient(id, { [c.dataset.k]: c.checked }); toast('Saved'); } catch (x) { c.checked = !c.checked; toast(errText(x)); }
    }));
    row.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', async (e) => {
      const act = e.currentTarget.dataset.act;
      e.currentTarget.disabled = true;
      try {
        if (act === 'remove') {
          if (!confirm('Stop emailing reports to this address and remove it?')) { e.currentTarget.disabled = false; return; }
          await cloud.removeReportRecipient(id); toast('Removed');
        } else if (act === 'resume') {
          await cloud.updateReportRecipient(id, { unsubscribed_at: null });
          await cloud.reportEmail('confirm', id); toast('Confirmation email sent again.');
        } else {
          await cloud.reportEmail(act, id);
          toast(act === 'test' ? 'Sample report sent.' : 'Confirmation email sent again.');
        }
      } catch (x) { toast(errText(x)); }
      refresh();
    }));
  });
}
