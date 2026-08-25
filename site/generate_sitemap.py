#!/usr/bin/env python3
"""
Regenerates sitemap.xml, including one <url> entry per listing in Supabase.

Run this locally whenever you add/update listings, before redeploying or
resubmitting the sitemap in Google Search Console:

    pip install requests
    python3 generate_sitemap.py

It writes sitemap.xml in the same folder, overwriting the previous version.
"""

import requests
from datetime import datetime, timezone

SITE_URL = "https://sarkaridisha.netlify.app"   # <-- change once you pick a domain

SUPABASE_URL = "https://xnagaojcdrcjthoazogp.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_Gh-xRyHii3daT3RodbJGQw_m9ekf_p7"

STATIC_PAGES = [
    ("/", "hourly", "1.0"),
    ("/sarkaridisha-contact.html", "monthly", "0.3"),
    ("/sarkaridisha-privacy.html", "yearly", "0.2"),
    ("/sarkaridisha-terms.html", "yearly", "0.2"),
    ("/sarkaridisha-disclaimer.html", "yearly", "0.2"),
]


def fetch_listings():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/listings",
        params={"select": "id,created_at"},
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def build_sitemap(listings):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for path, freq, priority in STATIC_PAGES:
        lines.append("  <url>")
        lines.append(f"    <loc>{SITE_URL}{path}</loc>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")

    for item in listings:
        loc = f"{SITE_URL}/sarkaridisha-detail.html?id={item['id']}"
        lastmod = (item.get("created_at") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.7</priority>")
        lines.append("  </url>")

    lines.append("</urlset>")
    return "\n".join(lines)


if __name__ == "__main__":
    listings = fetch_listings()
    sitemap = build_sitemap(listings)
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap)
    print(f"sitemap.xml written with {len(listings)} listing(s) + {len(STATIC_PAGES)} static page(s).")
