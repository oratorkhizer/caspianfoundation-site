// pledge-api: back end of the Diabetes Promise campaign (caspianfoundation.in/pledge).
// Deployed as a Supabase Edge Function in the caspianobesity project (same trust as the award),
// verify_jwt off: the browser calls it directly. Writes go through the service role only;
// the pledges table has RLS on and no policies.
// The desk (caspianfoundation.in/pledge-desk) uses the SAME passcode as the award desk,
// read from award_config.desk_passcode, so there is one Foundation passcode to remember.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const ORIGINS = [
  "https://caspianfoundation.in",
  "https://www.caspianfoundation.in",
  "http://localhost:8080",
];
function cors(origin: string | null) {
  const ok = origin && (ORIGINS.includes(origin) || /^https:\/\/caspianfoundation[a-z0-9-]*\.vercel\.app$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

// The promises a visitor can choose. Keys are stored; the wording lives on the page.
const PROMISES: Record<string, string[]> = {
  self_dm: ["feet", "hba1c", "eyes", "kidneys", "heart", "medicines"],
  loved_one: ["feet", "hba1c", "eyes", "kidneys", "heart", "medicines", "walk_with"],
  self_prevent: ["test", "walk", "drinks", "waist", "family_test"],
};
// Counter is shown publicly only once it is a number worth showing.
const SHOW_COUNT_FROM = 100;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function pbkdf2(pass: string, saltHex: string, iter: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}

// Plain text only: no tags, no control characters, no em dashes, collapsed spaces.
function text(s: unknown, max: number) {
  return String(s ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\u2014/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// Indian mobile: accepts 98765 43210, 098765..., +91 98765..., 91-98765..., returns +919876543210 or "".
export function normalisePhone(raw: unknown) {
  const d = String(raw ?? "").replace(/\D/g, "");
  let local = d;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
  else if (local.length === 13 && local.startsWith("091")) local = local.slice(3);
  return /^[6-9]\d{9}$/.test(local) ? "+91" + local : "";
}

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((x) => ALPHA[x % ALPHA.length]).join("");
}

async function count() {
  const { count: n } = await sb.from("pledges").select("id", { count: "exact", head: true });
  return n ?? 0;
}

async function submit(body: any, ip: string) {
  // Honeypot and fill time.
  if (body.website) return { status: 200, data: { ok: true, code: "XXXXXX", pledge_no: 0 } };
  if (typeof body.ms === "number" && body.ms < 2500) return { status: 400, data: { error: "Please take a moment and try again." } };

  const path = String(body.path || "");
  if (!PROMISES[path]) return { status: 400, data: { error: "Choose who this promise is for." } };
  const promise = String(body.promise || "");
  if (!PROMISES[path].includes(promise)) return { status: 400, data: { error: "Choose one promise." } };
  const name = text(body.name, 40);
  if (name.length < 2) return { status: 400, data: { error: "Please write your name as it should appear on the card." } };
  const dedicated = text(body.dedicated_to, 40) || null;
  if (path === "loved_one" && !dedicated) return { status: 400, data: { error: "Who is this promise for? Write a name, or Ammi, Abba, Nani and so on." } };
  const band = ["low", "moderate", "high"].includes(body.risk_band) ? body.risk_band : null;

  let phone = "";
  let optin = false;
  if (body.phone) {
    phone = normalisePhone(body.phone);
    if (!phone) return { status: 400, data: { error: "That does not look like a 10 digit Indian mobile number." } };
    if (body.consent !== true) return { status: 400, data: { error: "Tick the box to agree to the WhatsApp reminders, or leave the number empty." } };
    optin = true;
  }

  const ipHash = await sha256("pledge:" + ip);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await sb.from("pledges").select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("created_at", since);
  if ((recent ?? 0) >= 12) return { status: 429, data: { error: "Many promises from this connection in the last hour. Please try again later." } };

  let ref = String(body.ref || "").toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(ref)) ref = "";

  const utm: Record<string, string> = {};
  if (body.utm && typeof body.utm === "object") {
    for (const k of ["source", "medium", "campaign"]) if (body.utm[k]) utm[k] = text(body.utm[k], 60);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { data, error } = await sb.from("pledges").insert({
      code, name, path, promise, dedicated_to: dedicated, risk_band: band,
      lang: "en", ref_code: ref || null, phone: phone || null, wa_optin: optin,
      wa_consent_at: optin ? new Date().toISOString() : null,
      utm: Object.keys(utm).length ? utm : null, ip_hash: ipHash,
    }).select("code, pledge_no, created_at").single();
    if (!error) return { status: 200, data: { ok: true, ...data } };
    if (!String(error.message).includes("duplicate")) return { status: 500, data: { error: "Could not save the promise. Please try again." } };
  }
  return { status: 500, data: { error: "Could not save the promise. Please try again." } };
}

async function card(body: any) {
  const code = String(body.code || "").toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return { status: 400, data: { error: "Bad link." } };
  const { data } = await sb.from("pledges")
    .select("code, pledge_no, name, path, promise, dedicated_to, created_at").eq("code", code).maybeSingle();
  if (!data) return { status: 404, data: { error: "We could not find that promise." } };
  const { count: inspired } = await sb.from("pledges").select("id", { count: "exact", head: true }).eq("ref_code", code);
  return { status: 200, data: { ...data, inspired: inspired ?? 0 } };
}

async function admin(body: any) {
  const { data: cfg } = await sb.from("award_config").select("value").eq("key", "desk_passcode").maybeSingle();
  if (!cfg) return { status: 409, data: { error: "Set the Foundation desk passcode on the award desk first." } };
  const [, iter, salt, h] = String(cfg.value).split("$");
  if (!same(await pbkdf2(String(body.passcode || ""), salt, Number(iter)), h)) return { status: 401, data: { error: "Wrong passcode." } };

  if (body.op === "check") return { status: 200, data: { ok: true } };
  if (body.op === "list") {
    const { data, error } = await sb.from("pledges")
      .select("code, pledge_no, name, path, promise, dedicated_to, risk_band, ref_code, phone, wa_optin, followup_status, notes, utm, created_at")
      .order("created_at", { ascending: false }).limit(5000);
    if (error) return { status: 500, data: { error: "Could not read the promises." } };
    const inspired: Record<string, number> = {};
    for (const r of data!) if (r.ref_code) inspired[r.ref_code] = (inspired[r.ref_code] || 0) + 1;
    return { status: 200, data: { rows: data!.map((r) => ({ ...r, inspired: inspired[r.code] || 0 })) } };
  }
  if (body.op === "update") {
    const code = String(body.code || "");
    const patch: Record<string, unknown> = {};
    if (["new", "messaged", "tested", "booked", "no_reply", "opted_out"].includes(body.followup_status)) patch.followup_status = body.followup_status;
    if (typeof body.notes === "string") patch.notes = text(body.notes, 500);
    if (body.followup_status === "opted_out") patch.wa_optin = false;
    if (!/^[A-Z2-9]{6}$/.test(code) || !Object.keys(patch).length) return { status: 400, data: { error: "Bad request." } };
    const { error } = await sb.from("pledges").update(patch).eq("code", code);
    if (error) return { status: 400, data: { error: error.message } };
    return { status: 200, data: { ok: true } };
  }
  return { status: 400, data: { error: "Unknown request." } };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: h });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  let out: { status: number; data: unknown };
  try {
    switch (body.action) {
      case "stats": {
        const n = await count();
        out = { status: 200, data: { count: n >= SHOW_COUNT_FROM ? n : null } };
        break;
      }
      case "submit": out = await submit(body, ip); break;
      case "card": out = await card(body); break;
      case "admin": out = await admin(body); break;
      default: out = { status: 400, data: { error: "Unknown action." } };
    }
  } catch (_e) {
    out = { status: 500, data: { error: "Something went wrong. Please try again." } };
  }
  return new Response(JSON.stringify(out.data), {
    status: out.status,
    headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
