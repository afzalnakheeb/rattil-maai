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

async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || '';
  const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { authorization: auth, apikey } });
    if (!r.ok) return false;
    const u = await r.json();
    return !!u?.id;
  } catch (_) { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!(await signedIn(req))) return json({ error: 'sign-in required' }, 401);
  const keyId = Deno.env.get('CF_TURN_KEY_ID');
  const token = Deno.env.get('CF_TURN_API_TOKEN');
  let iceServers: unknown[] = STUN;
  let relay = false;
  if (keyId && token) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 14400 }),
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
