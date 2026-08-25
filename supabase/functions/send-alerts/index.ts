// ============================================================================
// SarkariDisha — send-alerts Edge Function
// Deploy with: supabase functions deploy send-alerts
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL")!;
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "SarkariDisha Alerts";
const WEBHOOK_SECRET = Deno.env.get("ALERTS_WEBHOOK_SECRET")!;
const SITE_URL = (Deno.env.get("SITE_URL") || "https://sarkaridisha.netlify.app").replace(/\/$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CATEGORY_LABEL: Record<string, string> = {
  job: "Job Notification",
  admit: "Admit Card",
  result: "Result",
  key: "Answer Key",
  admission: "Admission",
};

function describeChanges(oldRow: any, newRow: any): string[] {
  const changes: string[] = [];

  if (oldRow.tag !== newRow.tag && newRow.tag) {
    changes.push(`Status updated to **${newRow.tag}**`);
  }

  const oldDates = flattenDateRows(oldRow.important_dates);
  const newDates = flattenDateRows(newRow.important_dates);
  for (const [label, value] of newDates) {
    const prev = oldDates.get(label);
    if (value && value !== prev) {
      changes.push(prev ? `**${label}** updated: ${value}` : `**${label}** added: ${value}`);
    }
  }

  const oldLinks = new Set((oldRow.links || []).map((l: any) => l.label));
  const newLinks: any[] = newRow.links || [];
  for (const link of newLinks) {
    if (link.url && !oldLinks.has(link.label)) {
      changes.push(`New link added: **${link.label}**`);
    }
  }

  if ((oldRow.closing_date || "") !== (newRow.closing_date || "") && newRow.closing_date) {
    changes.push(`Last date to apply is now **${newRow.closing_date}**`);
  }

  return changes;
}

function flattenDateRows(rows: any): Map<string, string> {
  const map = new Map<string, string>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && typeof row.label === "string") map.set(row.label, row.value || "");
    }
  }
  return map;
}

function mdBoldToHtml(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

async function sendEmail(to: string, subject: string, htmlBody: string, unsubscribeToken: string) {
  const unsubscribeUrl = `${SITE_URL}/sarkaridisha-unsubscribe.html?token=${unsubscribeToken}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16233D;">
      <div style="background:#16233D;color:#FAF7F0;padding:18px 24px;font-size:18px;font-weight:700;">
        SarkariDisha
      </div>
      <div style="padding:24px;background:#FAF7F0;">
        ${htmlBody}
      </div>
      <div style="padding:16px 24px;font-size:11px;color:#544928;border-top:1px dashed #B9AE8E;">
        You're receiving this because you subscribed for alerts on SarkariDisha.
        <a href="${unsubscribeUrl}" style="color:#B8790F;">Unsubscribe</a>
      </div>
    </div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    console.error(`Brevo send failed for ${to}:`, await res.text());
  }
}

async function sendBatch(recipients: { email: string; unsubscribe_token: string }[], subject: string, htmlBody: string) {
  const CHUNK = 20;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    await Promise.all(chunk.map((r) => sendEmail(r.email, subject, htmlBody, r.unsubscribe_token)));
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const { type, table, record, old_record } = payload;

  if (table !== "listings") return new Response("ignored", { status: 200 });
  if (record.status === "draft") return new Response("draft, skipped", { status: 200 });

  const detailUrl = `${SITE_URL}/sarkaridisha-detail.html?id=${record.id}`;
  const catLabel = CATEGORY_LABEL[record.category] || "Listing";

  if (type === "INSERT") {
    const { data: subs, error } = await admin
      .from("subscribers")
      .select("email, unsubscribe_token")
      .eq("subscribed_all", true);

    if (error) {
      console.error(error);
      return new Response("db error", { status: 500 });
    }
    if (!subs || subs.length === 0) return new Response("no subscribers", { status: 200 });

    const subject = `New ${catLabel}: ${record.title}`;
    const html = `
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#B8790F;font-weight:700;margin:0 0 6px;">New ${catLabel}</p>
      <h2 style="font-family:Georgia,serif;margin:0 0 14px;">${record.title}</h2>
      <table style="font-size:14px;line-height:1.8;margin-bottom:18px;">
        ${record.dept ? `<tr><td style="color:#544928;padding-right:10px;">Department</td><td><strong>${record.dept}</strong></td></tr>` : ""}
        ${record.total_post ? `<tr><td style="color:#544928;padding-right:10px;">Total Posts</td><td><strong>${record.total_post}</strong></td></tr>` : ""}
        ${record.opening_date ? `<tr><td style="color:#544928;padding-right:10px;">Opens</td><td><strong>${record.opening_date}</strong></td></tr>` : ""}
        ${record.closing_date ? `<tr><td style="color:#544928;padding-right:10px;">Last Date</td><td><strong>${record.closing_date}</strong></td></tr>` : ""}
      </table>
      <a href="${detailUrl}" style="display:inline-block;background:#B8790F;color:#FAF7F0;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;">View Full Details →</a>
    `;

    await sendBatch(subs, subject, html);
    return new Response(`sent to ${subs.length} subscriber(s)`, { status: 200 });
  }

  if (type === "UPDATE") {
    const changes = describeChanges(old_record, record);
    if (changes.length === 0) return new Response("no notable change", { status: 200 });

    const { data: follows, error } = await admin
      .from("listing_subscriptions")
      .select("subscriber_id, subscribers(email, unsubscribe_token)")
      .eq("listing_id", record.id);

    if (error) {
      console.error(error);
      return new Response("db error", { status: 500 });
    }
    const subs = (follows || [])
      .map((f: any) => f.subscribers)
      .filter((s: any) => s && s.email);
    if (subs.length === 0) return new Response("no followers", { status: 200 });

    const subject = `Update: ${record.title}`;
    const html = `
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#B8790F;font-weight:700;margin:0 0 6px;">Listing Updated</p>
      <h2 style="font-family:Georgia,serif;margin:0 0 14px;">${record.title}</h2>
      <ul style="font-size:14px;line-height:1.9;padding-left:18px;margin:0 0 18px;">
        ${changes.map((c) => `<li>${mdBoldToHtml(c)}</li>`).join("")}
      </ul>
      <a href="${detailUrl}" style="display:inline-block;background:#1B6B6B;color:#FAF7F0;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;">View Full Details →</a>
    `;

    await sendBatch(subs, subject, html);
    return new Response(`sent to ${subs.length} follower(s)`, { status: 200 });
  }

  return new Response("ignored", { status: 200 });
});