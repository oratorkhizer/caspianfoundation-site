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


// ---------------- Scoring ----------------
const RUBRIC: Record<string, { key: string; label: string; max: number }[]> = {
  outcomes: [
    { key: "impact", label: "Clinical impact of the results", max: 30 },
    { key: "data", label: "Quality and honesty of data (numbers, follow up, drop outs stated)", max: 25 },
    { key: "relevance", label: "Relevance to Indian practice", max: 20 },
    { key: "repeat", label: "Can other doctors repeat it", max: 15 },
    { key: "clarity", label: "Clarity of the write up", max: 10 },
  ],
  innovation: [
    { key: "effect", label: "Effect on patients, shown with numbers", max: 35 },
    { key: "adopt", label: "Can other clinics adopt it", max: 25 },
    { key: "original", label: "Originality", max: 20 },
    { key: "cost", label: "Cost and sustainability", max: 10 },
    { key: "clarity", label: "Clarity of the write up", max: 10 },
  ],
  teaching: [
    { key: "learning", label: "Learning value for practising doctors", max: 35 },
    { key: "reasoning", label: "Quality of clinical reasoning", max: 25 },
    { key: "evidence", label: "Use of current evidence and guidelines", max: 20 },
    { key: "clarity", label: "Clarity and brevity", max: 20 },
  ],
  patients: [
    { key: "change", label: "Change in the patient's health and life", max: 60 },
    { key: "beyond", label: "Care beyond the routine", max: 40 },
  ],
};
const ROUND_CLOSE: Record<number, number> = {
  1: Date.parse("2026-11-05T23:59:59+05:30"),
  2: Date.parse("2026-11-09T23:59:59+05:30"),
};
const ENTRY_LIGHT = "id, ref, category, young, name, qualification, speciality, institution, city, state, title, status, screening, finalist, result";
const NOM_LIGHT = "id, ref, doctor_name, doctor_place, doctor_city, status, result";

async function roundOpen(round: number) {
  if ((await config("scoring_unlocked")) === "1") return true;
  return Date.now() <= ROUND_CLOSE[round];
}
const rubricFor = (subject: string, category?: string) => subject === "nomination" ? RUBRIC.patients : RUBRIC[category || ""];

async function scoringData() {
  const [a, j, e, n] = await Promise.all([
    sb.from("award_assignments").select("*").order("created_at"),
    sb.from("award_jurors").select("id, ref, name, designation, institution, city, status, token_issued_at").in("status", ["approved", "shortlisted"]),
    sb.from("award_entries").select(ENTRY_LIGHT).eq("status", "paid"),
    sb.from("award_nominations").select(NOM_LIGHT).in("status", ["shortlisted", "called_verified"]),
  ]);
  if (a.error || j.error || e.error || n.error) return null;
  return { assignments: a.data, jurors: j.data, entries: e.data, nominations: n.data, rubric: RUBRIC,
    unlocked: (await config("scoring_unlocked")) === "1", closes: ROUND_CLOSE };
}

async function scoringAdmin(body: any) {
  if (body.op === "scoring") {
    const d = await scoringData();
    return d ? json(d) : json({ error: "Could not read scoring data." }, 500);
  }
  if (body.op === "assign") {
    const round = Number(body.round), subject = String(body.subject);
    if (![1, 2].includes(round) || !["entry", "nomination"].includes(subject)) return json({ error: "Bad request." }, 400);
    const { error } = await sb.from("award_assignments").insert({ round, subject, subject_id: String(body.subject_id), juror_id: String(body.juror_id) });
    if (error) return json({ error: error.code === "23505" ? "That juror already has this entry." : error.message }, 400);
    return json({ ok: true });
  }
  if (body.op === "unassign") {
    const { data } = await sb.from("award_assignments").select("status").eq("id", String(body.id)).maybeSingle();
    if (!data) return json({ error: "Not found." }, 404);
    if (data.status === "scored" && !body.force) return json({ error: "This juror has already scored it. Remove anyway?", needForce: true }, 409);
    await sb.from("award_assignments").delete().eq("id", String(body.id));
    return json({ ok: true });
  }
  if (body.op === "auto-assign") {
    const round = Number(body.round);
    const d = await scoringData();
    if (!d) return json({ error: "Could not read scoring data." }, 500);
    const jurors = d.jurors.filter((x: any) => x.status === "approved");
    if (!jurors.length) return json({ error: "Approve at least one juror first (Jury applications tab)." }, 400);
    const load: Record<string, number> = {};
    jurors.forEach((x: any) => load[x.id] = 0);
    d.assignments.filter((a: any) => a.round === round && a.status !== "conflict").forEach((a: any) => { if (load[a.juror_id] !== undefined) load[a.juror_id]++; });
    const rows: any[] = [];
    let subjects: { subject: string; id: string; need: number }[] = [];
    if (round === 1) {
      subjects = d.entries.filter((x: any) => x.screening === "eligible").map((x: any) => ({ subject: "entry", id: x.id, need: 2 }))
        .concat(d.nominations.filter((x: any) => x.status === "shortlisted").map((x: any) => ({ subject: "nomination", id: x.id, need: 2 })));
    } else {
      subjects = d.entries.filter((x: any) => x.finalist).map((x: any) => ({ subject: "entry", id: x.id, need: jurors.length }));
    }
    for (const s of subjects) {
      const mine = d.assignments.filter((a: any) => a.round === round && a.subject === s.subject && a.subject_id === s.id);
      const taken = new Set(mine.map((a: any) => a.juror_id));
      const conflicted = new Set(d.assignments.filter((a: any) => a.subject === s.subject && a.subject_id === s.id && a.status === "conflict").map((a: any) => a.juror_id));
      let active = mine.filter((a: any) => a.status !== "conflict").length;
      const pool = jurors.filter((x: any) => !taken.has(x.id) && !conflicted.has(x.id)).sort((a: any, b: any) => load[a.id] - load[b.id]);
      for (const jr of pool) {
        if (active >= s.need) break;
        rows.push({ round, subject: s.subject, subject_id: s.id, juror_id: jr.id });
        load[jr.id]++; active++;
      }
    }
    if (rows.length) {
      const { error } = await sb.from("award_assignments").insert(rows);
      if (error) return json({ error: error.message }, 400);
    }
    return json({ ok: true, added: rows.length });
  }
  if (body.op === "issue-token") {
    const raw = crypto.getRandomValues(new Uint8Array(24));
    const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const { data, error } = await sb.from("award_jurors").update({ score_token_hash: await sha256(token), token_issued_at: new Date().toISOString() })
      .eq("id", String(body.juror_id)).select("id, name, phone, email").single();
    if (error) return json({ error: error.message }, 400);
    return json({ token, juror: data });
  }
  if (body.op === "set-result") {
    const table = body.table === "award_nominations" ? "award_nominations" : "award_entries";
    const patch: Record<string, unknown> = {};
    if (body.result !== undefined) patch.result = body.result || null;
    if (table === "award_entries" && body.finalist !== undefined) patch.finalist = !!body.finalist;
    const { error } = await sb.from(table).update(patch).eq("id", String(body.id));
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  if (body.op === "set-lock") {
    const v = body.unlocked ? "1" : "0";
    await sb.from("award_config").upsert({ key: "scoring_unlocked", value: v, updated_at: new Date().toISOString() });
    return json({ ok: true });
  }
  return null;
}

async function jurorFrom(token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await sb.from("award_jurors").select("id, ref, name, status").eq("score_token_hash", await sha256(token)).maybeSingle();
  return data && data.status === "approved" ? data : null;
}

async function jurorAction(body: any) {
  const jr = await jurorFrom(String(body.token || ""));
  if (!jr) return json({ error: "This scoring link is not valid. Please ask the secretariat for a fresh one." }, 401);
  const { data: mine } = await sb.from("award_assignments").select("*").eq("juror_id", jr.id).order("round").order("created_at");
  const list = mine || [];
  const find = (id: string) => list.find((a: any) => a.id === id);

  if (body.action === "juror_home") {
    const eIds = list.filter((a: any) => a.subject === "entry").map((a: any) => a.subject_id);
    const nIds = list.filter((a: any) => a.subject === "nomination").map((a: any) => a.subject_id);
    const [e, n] = await Promise.all([
      eIds.length ? sb.from("award_entries").select("id, ref, category, young, name, qualification, speciality, institution, city, state, title, problem, method, results, learning, team, pdf_path, photo_path").in("id", eIds) : { data: [] },
      nIds.length ? sb.from("award_nominations").select("id, ref, relation, doctor_name, doctor_place, doctor_city, since_year, story").in("id", nIds) : { data: [] },
    ]);
    const subj: Record<string, any> = {};
    (e.data || []).forEach((x: any) => subj["entry:" + x.id] = { ...x, has_pdf: !!x.pdf_path, has_photo: !!x.photo_path, pdf_path: undefined, photo_path: undefined });
    (n.data || []).forEach((x: any) => subj["nomination:" + x.id] = x);
    return json({
      juror: { name: jr.name, ref: jr.ref },
      assignments: list.map((a: any) => ({ id: a.id, round: a.round, subject: a.subject, status: a.status, scores: a.scores, total: a.total, feedback: a.feedback, conflict_note: a.conflict_note, submitted_at: a.submitted_at, item: subj[a.subject + ":" + a.subject_id] || null })),
      rubric: RUBRIC, open: { 1: await roundOpen(1), 2: await roundOpen(2) }, closes: ROUND_CLOSE,
    });
  }
  const a = find(String(body.assignment_id || ""));
  if (!a) return json({ error: "That item is not assigned to you." }, 404);

  if (body.action === "juror_file") {
    if (a.subject !== "entry") return json({ error: "No file." }, 400);
    const { data: e } = await sb.from("award_entries").select("pdf_path, photo_path").eq("id", a.subject_id).single();
    const p = body.which === "photo" ? e?.photo_path : e?.pdf_path;
    if (!p) return json({ error: "No file uploaded." }, 404);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(p, 600);
    if (error) return json({ error: "File not found." }, 404);
    return json({ url: data.signedUrl });
  }
  if (!(await roundOpen(a.round))) return json({ error: "Scoring for this round has closed. Please write to the secretariat if you need to change anything." }, 409);
  if (body.action === "juror_conflict") {
    const note = String(body.note || "").slice(0, 500).trim();
    if (!note) return json({ error: "Please say briefly how you know the applicant." }, 400);
    await sb.from("award_assignments").update({ status: "conflict", conflict_note: note, scores: null, total: null, submitted_at: null }).eq("id", a.id);
    return json({ ok: true });
  }
  if (body.action === "juror_score") {
    if (a.status === "conflict") return json({ error: "You declared a conflict for this item." }, 409);
    let category = "";
    if (a.subject === "entry") {
      const { data: e } = await sb.from("award_entries").select("category").eq("id", a.subject_id).single();
      category = e?.category || "";
    }
    const rub = rubricFor(a.subject, category);
    if (!rub) return json({ error: "No rubric for this item." }, 400);
    const scores: Record<string, number> = {};
    let total = 0, complete = true;
    for (const c of rub) {
      const raw = body.scores ? body.scores[c.key] : undefined;
      if (raw === undefined || raw === null || raw === "") { complete = false; continue; }
      const v = Math.round(Number(raw));
      if (!Number.isFinite(v) || v < 0 || v > c.max) return json({ error: `"${c.label}" must be between 0 and ${c.max}.` }, 400);
      scores[c.key] = v; total += v;
    }
    const feedback = String(body.feedback || "").slice(0, 3000).trim();
    const submit = !!body.submit;
    if (submit) {
      if (!complete) return json({ error: "Please score every criterion before submitting." }, 400);
      if (feedback.split(/\s+/).filter(Boolean).length < 15) return json({ error: "Please write at least a few lines of feedback (15 words or more). The applicant receives it." }, 400);
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { scores, total: complete ? total : null, feedback, saved_at: now };
    if (submit) { patch.status = "scored"; patch.submitted_at = now; }
    await sb.from("award_assignments").update(patch).eq("id", a.id);
    return json({ ok: true, total: complete ? total : null, submitted: submit });
  }
  return json({ error: "Unknown action" }, 400);
}

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

  if (body.op === "check") return json({ ok: true });
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
  const sc = await scoringAdmin(body);
  if (sc) return sc;
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
    case "juror_home":
    case "juror_file":
    case "juror_conflict":
    case "juror_score":
      return jurorAction(body);
  }
  return json({ error: "Unknown action" }, 400);
});
