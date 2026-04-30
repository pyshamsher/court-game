import puppeteer from "@cloudflare/puppeteer";

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// In-memory cache (persists across requests within same isolate, ~minutes)
let cachedMembers = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function scrapeMembers(env) {
  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  // Stealth: override navigator properties to avoid bot detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Login
  await page.goto(env.CLUB_URL + '/Sys/Login?ReturnUrl=%2fMember-Directory', { waitUntil: 'networkidle0', timeout: 25000 });
  await page.type('input[name="email"]', env.CLUB_EMAIL, { delay: 50 });
  await page.type('input[name="password"]', env.CLUB_PASSWORD, { delay: 50 });

  // Submit the form via JS
  await page.evaluate(() => {
    const form = document.querySelector('form.generalLoginBox');
    if (form) form.submit();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 });

  // Check if we landed on the member directory
  const url = page.url();
  if (url.includes('/Sys/Login')) {
    await browser.close();
    throw new Error('Login failed - still on login page. URL: ' + url);
  }

  // Wait for the table to load
  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});

  // Scrape all pages
  let allMembers = [];
  let hasNext = true;
  let pageNum = 0;

  while (hasNext && pageNum < 20) {
    pageNum++;
    const members = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      const results = [];
      rows.forEach(r => {
        const cells = r.querySelectorAll('td');
        if (cells.length >= 2) {
          const name = cells[0]?.textContent?.trim();
          const rating = cells[1]?.textContent?.trim();
          if (name && name !== 'Name' && name.length > 1) {
            results.push({ name, rating: rating === 'No Rating' ? '' : (rating || '') });
          }
        }
      });
      return results;
    });

    allMembers = allMembers.concat(members);

    // Check for next page link
    const nextExists = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.includes('Next') || a.textContent.includes('›') || a.textContent.includes('>')) {
          if (!a.classList.contains('disabled') && a.getAttribute('href')) {
            a.click();
            return true;
          }
        }
      }
      return false;
    });

    if (nextExists) {
      await page.waitForTimeout(2000);
    } else {
      hasNext = false;
    }
  }

  await browser.close();
  return allMembers;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    // /club-members — returns cached member list, scrapes if stale
    if (url.pathname === '/club-members') {
      try {
        // Return cache if fresh
        if (cachedMembers && (Date.now() - cacheTime) < CACHE_TTL) {
          return new Response(JSON.stringify({ members: cachedMembers, cached: true, count: cachedMembers.length, age: Math.round((Date.now() - cacheTime) / 60000) + ' min' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }

        // Scrape fresh data
        const members = await scrapeMembers(env);
        cachedMembers = members;
        cacheTime = Date.now();

        return new Response(JSON.stringify({ members, cached: false, count: members.length }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      } catch (e) {
        // Return stale cache if available
        if (cachedMembers) {
          return new Response(JSON.stringify({ members: cachedMembers, cached: true, error: e.message, count: cachedMembers.length }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }
    }

    // /club-members/search?name=Shamsher — search within cached list
    if (url.pathname === '/club-members/search') {
      const query = url.searchParams.get('name')?.toLowerCase() || '';
      if (!cachedMembers) {
        return new Response(JSON.stringify({ error: 'Cache empty. Hit /club-members first to load.' }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }
      const matches = cachedMembers.filter(m => m.name.toLowerCase().includes(query)).slice(0, 10);
      return new Response(JSON.stringify({ matches }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
      });
    }

    // /club-members/refresh — force refresh
    if (url.pathname === '/club-members/refresh') {
      try {
        const members = await scrapeMembers(env);
        cachedMembers = members;
        cacheTime = Date.now();
        return new Response(JSON.stringify({ members, count: members.length, refreshed: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
  }
};
