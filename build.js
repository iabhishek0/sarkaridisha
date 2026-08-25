/**
 * SarkariDisha static-build script (v2)
 * ---------------------------------------
 * Prerenders your homepage, all 5 category pages, and every individual
 * job/result/admit-card detail page into real static HTML — so Google
 * and the AdSense reviewer see full content in the page source, not an
 * empty shell that only fills in after JavaScript runs in a browser.
 *
 * HOW IT WORKS
 * This does NOT re-implement your rendering logic by hand (too fragile
 * to keep in sync with your real site). Instead it:
 *   1. Spins up a tiny local web server serving your actual site files
 *   2. Opens each page in a real headless browser (Puppeteer)
 *   3. Lets YOUR existing JavaScript run exactly as it does for a real
 *      visitor (fetching from Supabase, rendering listings, building
 *      the detail page tables, JSON-LD schema, meta tags, etc.)
 *   4. Saves the final rendered HTML to disk
 * So whatever a human sees in a browser is now exactly what's in the
 * page source too. Your original code / rendering logic is never
 * duplicated or forked — this just captures its output.
 *
 * OUTPUT
 *   dist/index.html                          — homepage, fully baked
 *   dist/sarkaridisha-category-job.html       — one static file per category
 *   dist/sarkaridisha-category-admit.html
 *   dist/sarkaridisha-category-result.html
 *   dist/sarkaridisha-category-key.html
 *   dist/sarkaridisha-category-admission.html
 *   dist/sarkaridisha-detail-<id>.html        — one static file per listing
 *   dist/_redirects                           — updated so your EXISTING
 *       links (e.g. sarkaridisha-category.html?cat=job,
 *       sarkaridisha-detail.html?id=123) transparently serve the
 *       matching static file above. You do not need to change any link
 *       anywhere on your site — this is handled automatically.
 *
 * HOW TO USE
 *   1. npm install         (one-time)
 *   2. node build.js
 *   3. Drag-and-drop everything INSIDE the generated dist/ folder to
 *      Netlify, same as you do now with your site/ folder.
 *
 * Re-run steps 2-3 any time your listings change and you want a fresh
 * deploy with up-to-date content baked in.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const SUPABASE_URL = 'https://xnagaojcdrcjthoazogp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gh-xRyHii3daT3RodbJGQw_m9ekf_p7';

const SRC_DIR = path.join(__dirname, 'site');
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = 8743;

const CATEGORIES = ['job', 'admit', 'result', 'key', 'admission'];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function copyRecursive(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function startStaticServer(rootDir, port) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(rootDir, urlPath);
    if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function fetchAllListings() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb
    .from('listings')
    .select('id, category, status')
    .is('deleted_at', null);
  if (error) throw new Error('Supabase fetch failed: ' + error.message);
  return data.filter((row) => row.status !== 'draft');
}

async function renderPage(browser, url, readyCheck) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the page's own DOM to actually show loaded content, instead of guessing
  // a network-response substring + fixed delay (that heuristic was unreliable — it
  // could resolve on an early/unrelated request and move on before Supabase data had
  // actually been rendered into the DOM, which is why category pages were coming out
  // empty even though detail pages happened to work).
  try {
    await page.waitForFunction(readyCheck, { timeout: 20000 });
  } catch (e) {
    console.warn(`\n  ! Timed out waiting for content to render at ${url} — saving whatever loaded.`);
  }
  const html = await page.content();
  await page.close();
  return html;
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------

async function build() {
  console.log('Fetching listing IDs/categories from Supabase...');
  const listings = await fetchAllListings();
  console.log(`Found ${listings.length} listings to prerender detail pages for.`);

  console.log('Copying site/ -> dist/ ...');
  copyRecursive(SRC_DIR, DIST_DIR);

  console.log('Starting local static server...');
  const server = await startStaticServer(DIST_DIR, PORT);
  const base = `http://localhost:${PORT}`;

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  try {
    // ---- homepage ----
    console.log('Prerendering homepage...');
    const homeHtml = await renderPage(browser, `${base}/index.html`, () => {
      const cols = document.querySelectorAll('.col .listings');
      return cols.length > 0 && Array.from(cols).some((el) => el.children.length > 0);
    });
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homeHtml);

    // ---- category pages ----
    const redirectLines = [];
    for (const cat of CATEGORIES) {
      console.log(`Prerendering category: ${cat} ...`);
      const url = `${base}/sarkaridisha-category.html?cat=${cat}`;
      const html = await renderPage(browser, url, () => {
        const container = document.getElementById('listingsContainer');
        const empty = document.getElementById('emptyState');
        // "loaded" means either real listing cards were added, or the page has
        // genuinely confirmed there are zero items for this category (empty-state shown).
        return (container && container.children.length > 0) ||
               (empty && empty.style.display !== 'none');
      });
      const outFile = `sarkaridisha-category-${cat}.html`;
      fs.writeFileSync(path.join(DIST_DIR, outFile), html);
      redirectLines.push(`/sarkaridisha-category.html cat=${cat}  /${outFile}  200!`);
    }

    // ---- detail pages ----
    let i = 0;
    for (const item of listings) {
      i++;
      process.stdout.write(`Prerendering detail page ${i}/${listings.length} (id=${item.id})...\r`);
      const url = `${base}/sarkaridisha-detail.html?id=${item.id}`;
      const html = await renderPage(browser, url, () => {
        // The page starts with a "Loading listing…" placeholder (#loadingMsg) and
        // fully replaces #mainContent's innerHTML once the real listing loads
        // (or once it confirms the listing wasn't found) — so its disappearance
        // is a reliable "done" signal either way.
        return !document.getElementById('loadingMsg');
      });
      const outFile = `sarkaridisha-detail-${item.id}.html`;
      fs.writeFileSync(path.join(DIST_DIR, outFile), html);
      redirectLines.push(`/sarkaridisha-detail.html id=${item.id}  /${outFile}  200!`);
    }
    console.log(`\nPrerendered ${listings.length} detail pages.`);

    // ---- update _redirects so existing links keep working ----
    const redirectsPath = path.join(DIST_DIR, '_redirects');
    const existing = fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : '';
    const marker = '# --- auto-generated by build.js: do not edit below this line ---';
    const baseContent = existing.split(marker)[0].trimEnd();
    const newContent = `${baseContent}\n\n${marker}\n${redirectLines.join('\n')}\n`;
    fs.writeFileSync(redirectsPath, newContent);

    console.log('\nDone! dist/ is ready to deploy.');
    console.log('Drag-and-drop everything inside dist/ to Netlify.');
  } finally {
    await browser.close();
    server.close();
  }
}

build().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});