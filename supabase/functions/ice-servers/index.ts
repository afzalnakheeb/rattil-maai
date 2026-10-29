// Returns ICE servers for the teacher-student video call. Signed-in users only.
// Always includes free public STUN. If Cloudflare TURN secrets are set
// (CF_TURN_KEY_ID, CF_TURN_API_TOKEN), adds short-lived TURN relays so calls
// connect on strict mobile and office networks too.
// Deployed to Supabase project "rattilmai" as the `ice-servers` Edge Function.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const STUN = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Returns the user's auth header if signed in, else null.
async function signedIn(req: Request): Promise<{ auth: string; apikey: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { authorization: auth, apikey } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? { auth, apikey } : null;
  } catch (_) { return null; }
}

// TURN relays (which cost money) only for someone in a live call. Row security limits the query to their own calls.
async function inLiveCall(h: { auth: string; apikey: string }): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 3 * 3600e3).toISOString();
    const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/calls?select=id&status=in.(ringing,active)&created_at=gte.${encodeURIComponent(since)}&limit=1`;
    const r = await fetch(url, { headers: { authorization: h.auth, apikey: h.apikey } });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (_) { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const who = await signedIn(req);
  if (!who) return json({ error: 'sign-in required' }, 401);
  const keyId = Deno.env.get('CF_TURN_KEY_ID');
  const token = Deno.env.get('CF_TURN_API_TOKEN');
  let iceServers: unknown[] = STUN;
  let relay = false;
  if (keyId && token && (await inLiveCall(who))) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 10800 }),
      });
      if (r.ok) {
        const j = await r.json();
        const turn = (j.iceServers || []).map((s: { urls: string | string[]; username?: string; credential?: string }) => ({
          ...s,
          urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !u.includes(':53')),
        }));
        iceServers = [...STUN, ...turn];
        relay = true;
      }
    } catch (_) { /* fall back to STUN */ }
  }
  return json({ iceServers, relay });
});
