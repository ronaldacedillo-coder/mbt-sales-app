import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Weekly digest -- runs every Friday 3PM Manila time via pg_cron (see the
// weekly-digest-friday-3pm-manila cron job). For the current week
// (Monday through the run date), compiles every APPROVED Field Contact
// Report per rep -- that's the same set of visits that make up their
// MCP (Actual) for the week, since MCP (Actual) is built directly from
// approved FCRs (see mcpActual.js) -- and emails:
//   - the NSM: one section covering every MBT Sales Engineer, each with
//     their own approved-FCR list for the week
//   - the Commercial AC Head: two sections, MBT Sales then Business
//     Development, same per-rep breakdown for both teams
// Each email also links to /reports/weekly?start=&end= -- a page in the
// app (role-scoped via RLS, same as FCR/MCP Approvals) where the NSM/Head
// can download every acknowledged FCR and MCP (Actual) for the period as
// one .zip of PDFs. Sending uses Gmail SMTP (no domain/DNS verification
// needed) -- set GMAIL_USER and GMAIL_APP_PASSWORD as Edge Function
// secrets for this to actually deliver (GMAIL_APP_PASSWORD is a
// 16-character App Password from a Gmail account with 2-Step
// Verification on, not your normal password). Without those secrets the
// function still runs and returns the compiled data (useful for testing)
// but skips sending.

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

function getWeekRange() {
  const mNow = manilaNow();
  const dow = mNow.getUTCDay(); // 0=Sun..6=Sat on the shifted clock
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(mNow.getTime() - daysSinceMonday * 86400000);
  return { start: fmtDate(monday), end: fmtDate(mNow), label: `${fmtDate(monday)} to ${fmtDate(mNow)}` };
}

type FcrRow = { id: string; visit_date: string; period: string | null; company_name: string };

// Only FCRs the NSM/Head has actually approved count here -- this is
// deliberately the internal `status` column, not client `ack_status`,
// matching what MCP (Actual) itself uses (fetchAcknowledgedVisits in
// mcpActual.js requires both, but for the still-open current week most
// approved FCRs are already acknowledged too).
async function fetchApprovedFcrs(repId: string, weekStart: string, weekEnd: string): Promise<FcrRow[]> {
  const { data, error } = await supabase
    .from("fcrs")
    .select("id, visit_date, period, customer_info, account:accounts(company_name)")
    .eq("created_by", repId)
    .eq("status", "approved")
    .gte("visit_date", weekStart)
    .lte("visit_date", weekEnd)
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
    : `<p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin:2px 0 0;">No approved FCRs this week.</p>`;

  return `
    <div style="margin-top:14px;">
      <p style="font-family:sans-serif;font-size:13px;font-weight:600;color:#111827;margin:0;">${repName}
        <span style="font-weight:400;color:#6b7280;"> &middot; MCP (Actual) this week: ${fcrs.length} approved visit${fcrs.length === 1 ? "" : "s"}</span>
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
    <p style="font-family:sans-serif;font-size:12px;color:#6b7280;margin:0;">${total} approved FCR${total === 1 ? "" : "s"} across ${repRows.length} rep${repRows.length === 1 ? "" : "s"} this week</p>
    ${repRows.map((r) => renderRepBlock(r.name, r.fcrs)).join("")}`;
}

// Prominent CTA linking to the in-app Weekly Report Download page, scoped
// to whichever team the recipient (NSM or Head) already has RLS access to.
function renderDownloadButton(downloadUrl: string): string {
  return `
    <div style="margin:24px 0;text-align:center;">
      <a href="${downloadUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block;">Download this week's FCRs &amp; MCP (Actual)</a>
      <p style="font-family:sans-serif;font-size:11px;color:#9ca3af;margin-top:8px;">Bundles every acknowledged FCR and archived MCP (Actual) into one .zip of PDFs. Log in to view.</p>
    </div>`;
}

Deno.serve(async (_req: Request) => {
  try {
    const { start, end, label } = getWeekRange();
    const downloadUrl = `${APP_URL}#/reports/weekly?start=${start}&end=${end}`;

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
      seRows.push({ name: rep.name, fcrs: await fetchApprovedFcrs(rep.id, start, end) });
    }

    const bdRows = [];
    for (const rep of bdReps) {
      bdRows.push({ name: rep.name, fcrs: await fetchApprovedFcrs(rep.id, start, end) });
    }

    // Service-role client can read auth.users via the admin API -- this is
    // how we get real deliverable email addresses without a duplicate
    // email column on user_profiles.
    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (usersError) throw usersError;
    const emailById: Record<string, string> = {};
    for (const u of usersPage?.users || []) emailById[u.id] = u.email || "";

    const footer = `<p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin-top:20px;">Open <a href="${APP_URL}">MBT Sales Operations</a> for full detail on any FCR or MCP.</p>`;

    const results: Record<string, unknown> = { week: label, seCount: seRows.length, bdCount: bdRows.length };

    if (nsmRow && emailById[nsmRow.id]) {
      const html = `
        <div style="font-family:sans-serif;">
          <h2>Weekly Approved FCRs &amp; MCP (Actual) -- MBT Sales -- ${label}</h2>
          <p>Every Field Contact Report approved this week for each MBT Sales Engineer, and the MCP (Actual) visits those approvals produce.</p>
          ${renderTeamSection("MBT Sales Team", seRows)}
          ${renderDownloadButton(downloadUrl)}
          ${footer}
        </div>`;
      results.nsm = await sendEmail(emailById[nsmRow.id], `Weekly Approved FCRs & MCP (Actual) -- MBT Sales -- ${label}`, html);
    } else {
      results.nsm = { skipped: true, reason: "no NSM row or email found" };
    }

    if (headRow && emailById[headRow.id]) {
      const html = `
        <div style="font-family:sans-serif;">
          <h2>Weekly Approved FCRs &amp; MCP (Actual) -- MBT Sales &amp; BD -- ${label}</h2>
          <p>Every Field Contact Report approved this week for each individual in both teams, and the MCP (Actual) visits those approvals produce.</p>
          ${renderTeamSection("MBT Sales Team", seRows)}
          ${renderTeamSection("Business Development Team", bdRows)}
          ${renderDownloadButton(downloadUrl)}
          ${footer}
        </div>`;
      results.head = await sendEmail(emailById[headRow.id], `Weekly Approved FCRs & MCP (Actual) -- MBT Sales & BD -- ${label}`, html);
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
    // Without this, denomailer's quoted-printable encoder can emit a
    // trailing "=20" (an escaped space right before a soft line-wrap) that
    // some mail clients render literally instead of decoding -- shows up
    // as stray "=20" text in the email body. This is denomailer's own
    // documented workaround for that class of line-break encoding bug.
    debug: { encodeLB: true },
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
