# One-time setup: let admins/editors upload PDFs from the admin panel

The admin panel now has an "Upload File" button under **Links** in the
Add/Edit Listing form. Before it will work, you need to do this **once**
in your Supabase dashboard (it's already free on your current plan).

## 1. Create the storage bucket

1. Go to your Supabase dashboard → open your SarkariDisha project.
2. In the left sidebar, click **Storage**.
3. Click **New bucket**.
4. Name it exactly: `notices` (lowercase, must match exactly).
5. Turn **ON** "Public bucket" — this lets anyone view/download the files
   (needed so visitors can open the PDFs), but only logged-in admins/editors
   can *upload* new ones.
6. Click **Create bucket**.

## 2. Allow logged-in admins/editors to upload

1. Still in **Storage**, click on the `notices` bucket → **Policies** tab.
2. Click **New policy** → choose **"For full customization"** (or
   "Create a policy from scratch").
3. Set it up like this:
   - Policy name: `Allow authenticated uploads`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - USING/WITH CHECK expression: `bucket_id = 'notices'`
4. Save.

That's it — read access is public (from the bucket being public), and only
someone logged into the admin panel (admin or editor) can upload.

## 3. Deploy the updated site

Upload/redeploy this whole folder to Netlify like before (drag-and-drop).
Two new things are included that make this work:

- `_redirects` — this makes uploaded files open at
  `https://sarkaridisha.netlify.app/notices/your-file.pdf`
  (your own address) instead of a `supabase.co` link.
- The updated `sarkaridisha-admin.html` with the upload button.

## 4. Try it

1. Log into the admin panel.
2. Add or edit a listing → scroll to **Links**.
3. Click **+ Add Link**, then **📎 Upload File**, pick a PDF from your
   computer.
4. The URL field fills in automatically (something like
   `/notices/1234567890-notice.pdf`).
5. Click **Save**/**Save Changes**.
6. Open the listing on the public site and click the link — it should open
   the PDF at your own site's address.

Any admin or editor, logged in from any computer, can now do this — no
need to touch code or redeploy for each new file.
