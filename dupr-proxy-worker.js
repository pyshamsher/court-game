// Cloudflare Worker — DUPR API CORS Proxy
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

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const target = 'https://api.dupr.gg' + url.pathname + url.search;

    // Strip browser headers that cause DUPR to reject as invalid CORS
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
