// Runs on Netlify's edge, only for requests to /sarkaridisha-detail.html (see netlify.toml).
//
// What this does, in plain terms:
//   1. A real visitor's browser, OR WhatsApp/Facebook/Twitter's "link preview" bot, requests
//      https://sarkaridisha.netlify.app/sarkaridisha-detail.html?id=123
//   2. This code reads that `id`, and asks Supabase for that one listing's title, description,
//      and poster image.
//   3. It fetches the REAL detail.html page exactly as it would normally be served, then swaps
//      the placeholder <title>/og:title/og:description/og:image tags in its <head> for that
//      specific listing's real details — nothing else about the page changes.
//   4. Real visitors' browsers still load the same interactive page as always (their own
//      JavaScript re-confirms/re-sets these same tags once the page finishes loading data,
//      exactly like it did before this function existed) — this only matters for link-preview
//      bots, which never run JavaScript and only ever see whatever came in this raw HTML.
//
// If anything at all goes wrong (bad id, network hiccup, listing not found, it's a draft),
// this simply falls back to serving the normal, unmodified page — nothing ever breaks because
// of this function.

const SUPABASE_URL = 'https://xnagaojcdrcjthoazogp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gh-xRyHii3daT3RodbJGQw_m9ekf_p7';
const SITE_URL = 'https://sarkaridisha.netlify.app';

function escapeHtml(str: string){
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async (request: Request, context: any) => {
  // Always start by getting the normal, unmodified page — if anything below fails,
  // we just hand this back untouched.
  const originalResponse = await context.next();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return originalResponse;

    const apiUrl = `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&select=title,description,poster_url,dept,total_post,category,status&limit=1`;
    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return originalResponse;

    const rows = await res.json();
    const item = Array.isArray(rows) ? rows[0] : null;
    if (!item || item.status === 'draft') return originalResponse;

    const catLabels: Record<string, string> = {
      job: 'Latest Job', admission: 'Admission', result: 'Result', admit: 'Admit Card', key: 'Answer Key',
    };

    const title = `${item.title} — SarkariDisha`;
    // Deliberately NOT using item.description here — that's a full paragraph, too long/detailed
    // for a share preview. This short line is built only from dept/category/post-count instead.
    const description = `${catLabels[item.category] || ''} update from ${item.dept || 'the department'}${item.total_post ? ` — ${item.total_post} posts` : ''} on SarkariDisha.`;
    const pageUrl = `${SITE_URL}/sarkaridisha-detail.html?id=${id}`;
    const imageUrl = item.poster_url
      ? (item.poster_url.startsWith('http') ? item.poster_url : `${SITE_URL}${item.poster_url}`)
      : `${SITE_URL}/og-image.png`;

    const titleEsc = escapeHtml(title);
    const descEsc = escapeHtml(description);
    const urlEsc = escapeHtml(pageUrl);
    const imageEsc = escapeHtml(imageUrl);

    let html = await originalResponse.text();

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${titleEsc}</title>`);
    html = html.replace(/(id="metaDescription"[^>]*content=")[^"]*(")/, `$1${descEsc}$2`);
    html = html.replace(/(id="canonicalLink"[^>]*href=")[^"]*(")/, `$1${urlEsc}$2`);
    html = html.replace(/(id="ogTitle"[^>]*content=")[^"]*(")/, `$1${titleEsc}$2`);
    html = html.replace(/(id="ogDescription"[^>]*content=")[^"]*(")/, `$1${descEsc}$2`);
    html = html.replace(/(id="ogUrl"[^>]*content=")[^"]*(")/, `$1${urlEsc}$2`);
    html = html.replace(/(id="ogImage"[^>]*content=")[^"]*(")/, `$1${imageEsc}$2`);
    html = html.replace(/(id="twitterImage"[^>]*content=")[^"]*(")/, `$1${imageEsc}$2`);

    return new Response(html, {
      status: originalResponse.status,
      headers: originalResponse.headers,
    });
  } catch (e) {
    // Any unexpected error at all — just serve the normal page instead of breaking it.
    return originalResponse;
  }
};

export const config = { path: "/sarkaridisha-detail.html" };