// award-api: back end of the CHF Diabesity Changemakers Award (caspianfoundation.in/award).
// Deployed as a Supabase Edge Function in the caspianobesity project (same trust, same data owner).
// Only the caspianfoundation.in serverless functions call it, with a shared server token whose
// SHA-256 sits in award_config. The desk passcode is checked here too (PBKDF2, never stored plain).
// This file is kept in the site repository for reference; deploy it with the Supabase CLI or MCP.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const BUCKET = "award-files";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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
async function config(key: string) {
  const { data } = await sb.from("award_config").select("value").eq("key", key).maybeSingle();
  return data ? (data.value as string) : null;
}

const KINDS: Record<string, { prefix: string; exts: string[] }> = {
  "entry-pdf": { prefix: "entry-pdf", exts: ["pdf"] },
  "entry-photo": { prefix: "entry-photo", exts: ["jpg", "jpeg", "png", "webp"] },
  "juror-cv": { prefix: "juror-cv", exts: ["pdf"] },
};
const ENTRY_COLS = ["category","young","qual_year","name","qualification","speciality","reg_no","council","institution","city","state","phone","email","title","problem","method","results","learning","team","pdf_path","photo_path","declarations","utm"];
const NOM_COLS = ["nominator_name","nominator_phone","nominator_email","relation","city","doctor_name","doctor_place","doctor_city","since_year","story","consent","utm"];
const JUROR_COLS = ["name","qualification","speciality","reg_no","council","designation","institution","city","state","pg_year","phone","email","expertise","roles","conflicts","linkedin","cv_path","declarations","utm"];
const pick = (o: Record<string, unknown>, cols: string[]) => {
  const r: Record<string, unknown> = {};
  for (const c of cols) if (o && o[c] !== undefined) r[c] = o[c];
  return r;
};
const validPath = (p: unknown, prefix: string) =>
  p == null || p === "" || (typeof p === "string" && p.startsWith(prefix + "/") && /^[a-z-]+\/[0-9]{4}-[0-9]{2}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(p));

async function admin(body: any) {
  const stored = await config("desk_passcode");
  if (body.op === "status") return json({ configured: !!stored });
  const pass = String(body.passcode || "");
  if (body.op === "setup") {
    if (stored) return json({ error: "The passcode is already set." }, 409);
    if (pass.length < 8) return json({ error: "Use at least 8 characters." }, 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const h = await pbkdf2(pass, salt, 150000);
    await sb.from("award_config").insert({ key: "desk_passcode", value: `pbkdf2$150000$${salt}$${h}` });
    return json({ ok: true });
  }
  if (!stored) return json({ error: "Set a passcode first." }, 409);
  const [, iter, salt, h] = stored.split("$");
  if (!same(await pbkdf2(pass, salt, Number(iter)), h)) return json({ error: "Wrong passcode." }, 401);

  if (body.op === "list") {
    const [e, n, j] = await Promise.all([
      sb.from("award_entries").select("*").order("created_at", { ascending: false }),
      sb.from("award_nominations").select("*").order("created_at", { ascending: false }),
      sb.from("award_jurors").select("*").order("created_at", { ascending: false }),
    ]);
    if (e.error || n.error || j.error) return json({ error: "Could not read the records." }, 500);
    return json({ entries: e.data, nominations: n.data, jurors: j.data });
  }
  if (body.op === "update") {
    const allowed: Record<string, string[]> = {
      award_entries: ["screening", "notes", "status"],
      award_nominations: ["status", "notes"],
      award_jurors: ["status", "notes"],
    };
    const cols = allowed[body.table];
    if (!cols || typeof body.id !== "string") return json({ error: "Bad request." }, 400);
    const patch = pick(body.fields || {}, cols);
    if (!Object.keys(patch).length) return json({ error: "Nothing to change." }, 400);
    const { error } = await sb.from(body.table).update(patch).eq("id", body.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  if (body.op === "file") {
    const p = String(body.path || "");
    if (!Object.values(KINDS).some((k) => validPath(p, k.prefix)) || !p) return json({ error: "Bad path." }, 400);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(p, 600);
    if (error) return json({ error: "File not found." }, 404);
    return json({ url: data.signedUrl });
  }
  if (body.op === "change-passcode") {
    const next = String(body.next || "");
    if (next.length < 8) return json({ error: "Use at least 8 characters." }, 400);
    const s2 = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    await sb.from("award_config").update({ value: `pbkdf2$150000$${s2}$${await pbkdf2(next, s2, 150000)}`, updated_at: new Date().toISOString() }).eq("key", "desk_passcode");
    return json({ ok: true });
  }
  return json({ error: "Unknown operation." }, 400);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const tokenHash = await config("server_token_sha256");
  const given = req.headers.get("x-award-token") || "";
  if (!tokenHash || !same(await sha256(given), tokenHash)) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  switch (body.action) {
    case "upload_url": {
      const k = KINDS[body.kind];
      const ext = String(body.ext || "").toLowerCase();
      if (!k || !k.exts.includes(ext)) return json({ error: "That file type is not accepted." }, 400);
      const month = new Date().toISOString().slice(0, 7);
      const path = `${k.prefix}/${month}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) return json({ error: "Could not prepare the upload." }, 500);
      return json({ path, url: data.signedUrl });
    }
    case "create_entry": {
      const row = pick(body.entry || {}, ENTRY_COLS);
      if (!validPath(row.pdf_path, "entry-pdf") || !validPath(row.photo_path, "entry-photo")) return json({ error: "Bad file reference." }, 400);
      const { data, error } = await sb.from("award_entries").insert(row).select("id, ref").single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }
    case "set_link": {
      const { error } = await sb.from("award_entries")
        .update({ rzp_link_id: String(body.link_id || ""), amount_paise: Number(body.amount) || null })
        .eq("id", String(body.id || "")).eq("status", "pending_payment");
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    case "mark_paid": {
      const link = String(body.link_id || "");
      const { data: row } = await sb.from("award_entries").select("*").eq("rzp_link_id", link).maybeSingle();
      if (!row) return json({ error: "No entry for that payment." }, 404);
      if (row.status === "paid") return json({ already: true, entry: row });
      const { data, error } = await sb.from("award_entries")
        .update({ status: "paid", rzp_payment_id: String(body.payment_id || ""), paid_at: new Date().toISOString() })
        .eq("id", row.id).select("*").single();
      if (error) return json({ error: error.message }, 400);
      return json({ already: false, entry: data });
    }
    case "create_nomination": {
      const { data, error } = await sb.from("award_nominations").insert(pick(body.nomination || {}, NOM_COLS)).select("id, ref").single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }
    case "create_juror": {
      const row = pick(body.juror || {}, JUROR_COLS);
      if (!validPath(row.cv_path, "juror-cv")) return json({ error: "Bad file reference." }, 400);
      const { data, error } = await sb.from("award_jurors").insert(row).select("id, ref").single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }
    case "admin":
      return admin(body);
  }
  return json({ error: "Unknown action" }, 400);
});
