import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Monthly digest -- runs 3PM Manila on the 1st of every month via pg_cron
// (see the monthly-digest-1st-3pm-manila cron job), covering the month
// that just ended. For each rep, compiles the full MCP (Actual) for that
// month -- the same "approved AND account-acknowledged" FCR set
// fetchAcknowledgedVisits (mcpActual.js) uses to build the on-screen
// MCP (Actual) calendar -- and emails:
//   - the NSM: every MBT Sales Engineer's full month
//   - the Commercial AC Head: every MBT Sales Engineer's AND every
//     Business Development team member's full month
// Each email links to /export?start=&end= (Export Center, pre-scoped to
// the month) where the recipient can pull consolidated Excel/PDF reports
// or per-rep zipped FCR PDFs. Sending uses Gmail SMTP -- set GMAIL_USER
// and GMAIL_APP_PASSWORD as Edge Function secrets (same ones weekly-digest
// uses) for this to actually deliver. Without those secrets the function
// still runs and returns the compiled data (useful for testing) but skips
// sending.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
const FROM_NAME = Deno.env.get("DIGEST_FROM_NAME") || "MBT Sales Operations";
const APP_URL = Deno.env.get("APP_URL") || "https://ronaldacedillo-coder.github.io/mbt-sales-app/";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Shifts real UTC "now" by +8h so that reading it back with UTC getters
// gives Manila wall-clock components, without pulling in a timezone lib.
function manilaNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The cron fires on the 1st, so "the month" is always the one that just
// closed -- e.g. running Aug 1 covers July 1 - July 31.
function getPrevMonthRange() {
  const mNow = manilaNow();
  const y = mNow.getUTCFullYear();
  const m = mNow.getUTCMonth(); // 0-based; current month
  const prevMonthLastDay = new Date(Date.UTC(y, m, 0)); // day 0 of current month = last day of previous month
  const prevMonthFirstDay = new Date(Date.UTC(prevMonthLastDay.getUTCFullYear(), prevMonthLastDay.getUTCMonth(), 1));
  const start = fmtDate(prevMonthFirstDay);
  const end = fmtDate(prevMonthLastDay);
  const label = prevMonthFirstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

type FcrRow = { id: string; visit_date: string; period: string | null; company_name: string };

// Mirrors fetchAcknowledgedVisits in mcpActual.js exactly -- both gates
// (internal approval AND account acknowledgment) -- so the count in this
// email always matches what the rep's own MCP (Actual) screen shows for
// the same month.
async function fetchMonthlyMcpActual(repId: string, monthStart: string, monthEnd: string): Promise<FcrRow[]> {
  const { data, error } = await supabase
    .from("fcrs")
    .select("id, visit_date, period, customer_info, account:accounts(company_name)")
    .eq("created_by", repId)
    .eq("status", "approved")
    .eq("ack_status", "acknowledged")
    .gte("visit_date", monthStart)
    .lte("visit_date", monthEnd)
    .order("visit_date");
  if (error) throw error;
  return (data || []).map((f: any) => ({
    id: f.id,
    visit_date: f.visit_date,
    period: f.period,
    company_name: f.account?.company_name || f.customer_info?.company_name || "Unknown account",
  }));
}

function renderRepBlock(repName: string, fcrs: FcrRow[]): string {
  const rows = fcrs
    .map(
      (f) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;">${fmtLong(f.visit_date)}${f.period ? ` (${f.period})` : ""}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;">${f.company_name}</td>
    </tr>`
    )
    .join("");

  const table = fcrs.length
    ? `
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:12px;margin-top:4px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Visit Date</th>
          <th style="padding:6px 8px;text-align:left;border:1px solid #e5e7eb;">Account</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
    : `<p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin:2px 0 0;">No MCP (Actual) visits this month.</p>`;

  return `
    <div style="margin-top:14px;">
      <p style="font-family:sans-serif;font-size:13px;font-weight:600;color:#111827;margin:0;">${repName}
        <span style="font-weight:400;color:#6b7280;"> &middot; MCP (Actual): ${fcrs.length} visit${fcrs.length === 1 ? "" : "s"}</span>
      </p>
      ${table}
    </div>`;
}

function renderTeamSection(title: string, repRows: { name: string; fcrs: FcrRow[] }[]): string {
  if (!repRows.length) {
    return `<h3 style="font-family:sans-serif;margin-top:24px;">${title}</h3><p style="font-family:sans-serif;color:#6b7280;font-size:13px;">No team members found.</p>`;
  }
  const total = repRows.reduce((sum, r) => sum + r.fcrs.length, 0);
  return `
    <h3 style="font-family:sans-serif;margin-top:24px;margin-bottom:2px;">${title}</h3>
    <p style="font-family:sans-serif;font-size:12px;color:#6b7280;margin:0;">${total} MCP (Actual) visit${total === 1 ? "" : "s"} across ${repRows.length} rep${repRows.length === 1 ? "" : "s"} this month</p>
    ${repRows.map((r) => renderRepBlock(r.name, r.fcrs)).join("")}`;
}

// Prominent CTA linking to Export Center pre-scoped to the month, where the
// recipient can pull consolidated Excel/PDF reports or per-rep zipped FCR
// PDFs for every approved report in the period.
function renderDownloadButton(downloadUrl: string): string {
  return `
    <div style="margin:24px 0;text-align:center;">
      <a href="${downloadUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block;">Download this month's FCRs &amp; MCP (Actual)</a>
      <p style="font-family:sans-serif;font-size:11px;color:#9ca3af;margin-top:8px;">Opens Export Center pre-scoped to this month -- consolidated Excel/PDF, or per-rep FCR zips. Log in to view.</p>
    </div>`;
}

Deno.serve(async (_req: Request) => {
  try {
    const { start, end, label } = getPrevMonthRange();
    const downloadUrl = `${APP_URL}#/export?start=${start}&end=${end}`;

    // Excludes anyone forced to VIEWER in this app via sales_app_role_override
    // (e.g. someone kept on the roster in MBT Project Pipeline but who should
    // only ever have read-only access here) -- same exclusion pattern used
    // everywhere else a team-member list is built (Dashboard, Export Center,
    // AccountForm).
    const { data: reps, error: repsError } = await supabase
      .from("user_profiles")
      .select("id, name, role")
      .in("role", ["se", "bd", "nsm", "head"])
      .or("sales_app_role_override.is.null,sales_app_role_override.neq.viewer");
    if (repsError) throw repsError;

    const seReps = (reps || []).filter((r) => r.role === "se");
    const bdReps = (reps || []).filter((r) => r.role === "bd");
    const nsmRow = (reps || []).find((r) => r.role === "nsm");
    const headRow = (reps || []).find((r) => r.role === "head");

    const seRows = [];
    for (const rep of seReps) {
      seRows.push({ name: rep.name, fcrs: await fetchMonthlyMcpActual(rep.id, start, end) });
    }

    const bdRows = [];
    for (const rep of bdReps) {
      bdRows.push({ name: rep.name, fcrs: await fetchMonthlyMcpActual(rep.id, start, end) });
    }

    // Service-role client can read auth.users via the admin API -- this is
    // how we get real deliverable email addresses without a duplicate
    // email column on user_profiles.
    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (usersError) throw usersError;
    const emailById: Record<string, string> = {};
    for (const u of usersPage?.users || []) emailById[u.id] = u.email || "";

    const footer = `<p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin-top:20px;">Open <a href="${APP_URL}">MBT Sales Operations</a> for full detail on any FCR or MCP.</p>`;

    const results: Record<string, unknown> = { month: label, seCount: seRows.length, bdCount: bdRows.length };

    if (nsmRow && emailById[nsmRow.id]) {
      const html = `
        <div style="font-family:sans-serif;">
          <h2>Monthly MCP (Actual) -- MBT Sales -- ${label}</h2>
          <p>Every approved and account-acknowledged FCR for the month, per MBT Sales Engineer -- their full MCP (Actual) for ${label}.</p>
          ${renderTeamSection("MBT Sales Team", seRows)}
          ${renderDownloadButton(downloadUrl)}
          ${footer}
        </div>`;
      results.nsm = await sendEmail(emailById[nsmRow.id], `Monthly MCP (Actual) -- MBT Sales -- ${label}`, html);
    } else {
      results.nsm = { skipped: true, reason: "no NSM row or email found" };
    }

    if (headRow && emailById[headRow.id]) {
      const html = `
        <div style="font-family:sans-serif;">
          <h2>Monthly MCP (Actual) -- MBT Sales &amp; BD -- ${label}</h2>
          <p>Every approved and account-acknowledged FCR for the month, per individual in both teams -- their full MCP (Actual) for ${label}.</p>
          ${renderTeamSection("MBT Sales Team", seRows)}
          ${renderTeamSection("Business Development Team", bdRows)}
          ${renderDownloadButton(downloadUrl)}
          ${footer}
        </div>`;
      results.head = await sendEmail(emailById[headRow.id], `Monthly MCP (Actual) -- MBT Sales & BD -- ${label}`, html);
    } else {
      results.head = { skipped: true, reason: "no Head row or email found" };
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.log("GMAIL_USER/GMAIL_APP_PASSWORD not set -- skipping send to", to);
    return { skipped: true };
  }
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });
  try {
    await client.send({
      from: `${FROM_NAME} <${GMAIL_USER}>`,
      to: [to],
      subject,
      content: "This email contains HTML content -- please view it in an HTML-capable email client.",
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("Gmail SMTP error for", to, err);
    return { sent: false, error: String(err) };
  } finally {
    await client.close();
  }
}
