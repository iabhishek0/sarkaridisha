# SarkariDisha static-build tool (v2)

This prerenders your **homepage**, all **5 category pages**, and **every
individual job/result/admit-card detail page** into real static HTML —
so Google and the AdSense reviewer see full content in the page source,
not an empty shell that only fills in after JavaScript runs.

It works by opening each page in a real (headless) browser, letting your
own existing code run exactly as it does for a normal visitor, and
saving the final rendered result. Your site's design, logic, and
Supabase data are never modified — this only captures a snapshot.

---

## PART 1 — One-time setup (do this once)

You need [Node.js](https://nodejs.org) installed. Download the LTS
version and install it if you don't have it already.

1. Unzip this folder somewhere on your computer.
2. Open a terminal / command prompt **inside this folder**
   (the one containing `build.js` and `package.json`).
3. Run:
   ```
   npm install
   ```
   This downloads everything needed, including a headless Chrome browser
   for prerendering. It's a bigger download than usual (~200MB) — only
   happens once.

---

## PART 2 — Every time you want to deploy

1. In the same folder, run:
   ```
   node build.js
   ```
   This will:
   - Fetch your current listings from Supabase
   - Prerender the homepage, all 5 category pages, and every individual
     listing's detail page
   - Write everything into a `dist/` folder

   This can take a little while if you have many listings (it renders
   one page at a time, like a real visitor would see it). You'll see
   progress printed in the terminal.

2. Once it says **"Done! dist/ is ready to deploy."**, open the `dist/`
   folder, select **all files inside it**, and drag-and-drop them onto
   Netlify — exactly like you do now.

That's it. Repeat steps 1-2 any time your listings change and you want
a fresh deploy.

---

## What to check after deploying

1. Open your live site.
2. Right-click → **View Page Source** (NOT "Inspect" — that shows the
   live DOM after JS runs, which always looks fine. You specifically
   need "View Page Source" / Ctrl+U, which shows the raw HTML a crawler
   sees).
3. You should now see real job titles, department names, and links
   directly in the raw HTML — on the homepage, on category pages (e.g.
   click "See More" under any column), and on individual listing pages.

If you see real content there, the "low value content" / empty-page
issue is fixed on the technical side.

---

## Steps to take from here (in order)

1. **Run the tool and redeploy**, as above.
2. **Verify via View Page Source** on the homepage, one category page,
   and one detail page, as described above.
3. **Review your actual listing content honestly.** Even with this fix,
   Google can still flag "low value content" if listings are extremely
   thin (just a title + one date + a link, with nothing else). Where you
   can, add a couple of original sentences to each listing — eligibility,
   how to apply, important dates — rather than only the bare fields.
4. **Do NOT check "I confirm that I have fixed the issues" and click
   Request Review yet.** Only do that after step 2 is confirmed working
   on your live deployed site — not just locally.
5. Once confirmed, go back to the AdSense Policy Center screen, check
   the confirmation box, and click **Request Review**.
6. Reviews typically take some days. In the meantime, keep the site as
   fully working and content-complete as possible; avoid making major
   structural changes right after requesting review.

---

## Important limitations to know about

- **This is a manual step**, not automatic. If you add new listings and
  don't re-run `node build.js` + redeploy, your live static pages will
  be out of date (though your site will still technically work, since
  the original dynamic pages are kept as a fallback for anything not
  prerendered).
- **Longer-term fix**: connect this project to a GitHub repository and
  link that repo to Netlify, with `node build.js` as the build command
  and `dist` as the publish directory. Netlify can then run this
  automatically on every deploy, and you can schedule periodic rebuilds
  (e.g. every few hours) so new listings show up without any manual
  steps. Ask Claude for help setting this up once you're past the
  AdSense review.
