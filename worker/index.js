// Cloudflare Worker — DUPR API CORS Proxy + Lookup
const ALLOWED_ORIGINS = [
  'https://pickleball-tracker.surge.sh',
  'https://pickleball-tracker-dev.surge.sh',
  'http://localhost',
  'http://127.0.0.1'
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.some(o => origin?.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResp(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

async function duprLogin(env) {
  const data = await duprLoginFull(env);
  return data ? data.result.accessToken : null;
}

async function duprLoginFull(env) {
  const res = await fetch('https://api.dupr.gg/auth/v1.0/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.DUPR_EMAIL, password: env.DUPR_PASSWORD })
  });
  const data = await res.json();
  if (data.status !== 'SUCCESS') return null;
  return data;
}

async function searchPlayer(name, token, loginData) {
  // Check if the name matches the logged-in user (self-match)
  if (loginData && loginData.result && loginData.result.user) {
    const u = loginData.result.user;
    const selfName = u.fullName || ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
    const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
    if (selfName && (norm(name) === norm(selfName) || selfName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(selfName.toLowerCase()))) {
      const rating = parseFloat(u.ratings?.doubles) || parseFloat(u.ratings?.singles) || 0;
      if (rating > 0) return { name: selfName, dupr: rating };
    }
  }
  const doSearch = async (q) => {
    const r = await fetch('https://api.dupr.gg/player/v1.0/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query: q, limit: 10, offset: 0, filter: { lat: 51.05, lng: -114.07, radiusInMeters: 1000000 }, includeUnclaimedPlayers: false })
    });
    return r.json();
  };
  let data = await doSearch(name);
  if (data.status === 'SUCCESS' && data.result && (!data.result.hits || !data.result.hits.length)) {
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) data = await doSearch(parts[parts.length - 1]);
  }
  const hits = (data.status === 'SUCCESS' && data.result && data.result.hits) || [];
  if (!hits.length) return null;
  // Fuzzy match — prioritize last name match
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const tokens = name.toLowerCase().split(/\s+/);
  let best = null, bestScore = 0;
  for (const h of hits) {
    if (!h.fullName) continue;
    const fn = h.fullName.toLowerCase();
    if (fn === name.toLowerCase()) return { name: h.fullName, dupr: parseFloat(h.ratings?.doubles) || parseFloat(h.ratings?.singles) || 0 };
    let score = 0;
    const tokensFound = tokens.filter(t => fn.includes(t)).length;
    score += tokensFound * 3;
    const hParts = fn.split(/\s+/);
    if (tokens.length > 1 && hParts.length > 1 && hParts[hParts.length - 1] === tokens[tokens.length - 1]) score += 5;
    if (tokens[0] && hParts[0] && (hParts[0].startsWith(tokens[0]) || tokens[0].startsWith(hParts[0]))) score += 2;
    if (score > bestScore) { bestScore = score; best = h; }
  }
  const match = bestScore >= 3 ? best : hits[0];
  if (!match) return null;
  return { name: match.fullName, dupr: parseFloat(match.ratings?.doubles) || parseFloat(match.ratings?.singles) || 0 };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    // /lookup?name=John+Smith — uses stored credentials, returns best match
    if (url.pathname === '/lookup') {
      const name = url.searchParams.get('name');
      if (!name) return jsonResp({ error: 'name param required' }, origin, 400);
      if (!env.DUPR_EMAIL || !env.DUPR_PASSWORD) return jsonResp({ error: 'DUPR credentials not configured' }, origin, 500);
      const loginData = await duprLoginFull(env);
      if (!loginData) return jsonResp({ error: 'DUPR login failed' }, origin, 500);
      const token = loginData.result.accessToken;
      const result = await searchPlayer(name, token, loginData);
      return jsonResp(result || { name, dupr: 0 }, origin);
    }

    // /search?name=John — returns multiple matches for autocomplete
    if (url.pathname === '/search') {
      const name = url.searchParams.get('name');
      if (!name || name.length < 2) return jsonResp({ hits: [] }, origin);
      if (!env.DUPR_EMAIL || !env.DUPR_PASSWORD) return jsonResp({ error: 'DUPR credentials not configured' }, origin, 500);
      const token = await duprLogin(env);
      if (!token) return jsonResp({ error: 'DUPR login failed' }, origin, 500);
      const doSearch = async (q) => {
        const r = await fetch('https://api.dupr.gg/player/v1.0/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ query: q, limit: 8, offset: 0, filter: { lat: 51.05, lng: -114.07, radiusInMeters: 1000000 }, includeUnclaimedPlayers: false })
        });
        return r.json();
      };
      let data = await doSearch(name);
      let hits = (data.status === 'SUCCESS' && data.result && data.result.hits) || [];
      // Also search last name if input has multiple words
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) {
        const lastData = await doSearch(parts[parts.length - 1]);
        const lastHits = (lastData.status === 'SUCCESS' && lastData.result && lastData.result.hits) || [];
        const seen = new Set(hits.map(h => h.fullName));
        lastHits.forEach(h => { if (!seen.has(h.fullName)) hits.push(h); });
      }
      return jsonResp({ hits: hits.map(h => ({ name: h.fullName, dupr: parseFloat(h.ratings?.doubles) || parseFloat(h.ratings?.singles) || 0, location: h.location?.display || '' })) }, origin);
    }

    // Default: proxy to DUPR API
    const target = 'https://api.dupr.gg' + url.pathname + url.search;
    const headers = new Headers(request.headers);
    headers.delete('Origin');
    headers.delete('Referer');
    headers.set('Host', 'api.dupr.gg');

    const resp = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    const newResp = new Response(resp.body, resp);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => newResp.headers.set(k, v));
    return newResp;
  }
};
