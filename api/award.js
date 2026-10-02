// Diabesity Changemakers Award: one endpoint, routed by ?op=
//   upload    signed upload URL for a PDF or photo (the file goes straight to private storage)
//   apply     doctor entry: stores it, then creates a Rs 999 Razorpay Payment Link
//   nominate  free patient or caregiver nomination (Patients' Choice)
//   juror     application to serve on the jury
//   desk      passcode-protected secretariat view, passed through to the award back end
import {
  SITE, FEE_RUPEES, ENTRIES_CLOSE, JURY_CLOSE, YOUNG_FROM_YEAR, EMAIL, CATEGORY_NAMES,
  clean, line, words, normalisePhone, body, utm, callAward, alert
} from './_award-lib.js';

const send = (res, status, data) => res.status(status).json(data);
const fail = (res, msg, status) => send(res, status || 400, { error: msg });

const LIMITS = { 'entry-pdf': 5 * 1024 * 1024, 'entry-photo': 2 * 1024 * 1024, 'juror-cv': 5 * 1024 * 1024 };

async function upload(b, res) {
  const kind = String(b.kind || '');
  const ext = String(b.ext || '').toLowerCase().replace(/[^a-z]/g, '');
  const size = Number(b.size) || 0;
  if (!LIMITS[kind]) return fail(res, 'Unknown file type.');
  if (size <= 0 || size > LIMITS[kind]) {
    return fail(res, 'That file is too large. The limit is ' + (LIMITS[kind] / 1048576) + ' MB.');
  }
  if (kind !== 'juror-cv' && Date.now() > ENTRIES_CLOSE) return fail(res, 'Entries have closed.');
  if (kind === 'juror-cv' && Date.now() > JURY_CLOSE) return fail(res, 'Jury applications have closed.');
  const r = await callAward({ action: 'upload_url', kind, ext });
  return send(res, r.ok ? 200 : r.status, r.data);
}

function requireFields(obj, list) {
  for (const [key, label] of list) if (!obj[key]) return label;
  return null;
}

async function apply(b, res) {
  if (Date.now() > ENTRIES_CLOSE) return fail(res, 'Entries for 2026 closed on 26 October.');
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return fail(res, 'Payments are not configured yet. Please write to info@caspianfoundation.in.', 500);

  const e = b.entry || {};
  if (line(e.website, 60)) return fail(res, 'Rejected.');
  const entry = {
    category: String(e.category || ''),
    young: !!e.young,
    qual_year: Number(e.qual_year) || null,
    name: line(e.name, 120),
    qualification: line(e.qualification, 160),
    speciality: line(e.speciality, 120),
    reg_no: line(e.reg_no, 40),
    council: line(e.council, 120),
    institution: line(e.institution, 200),
    city: line(e.city, 80),
    state: line(e.state, 60),
    phone: normalisePhone(e.phone),
    email: line(e.email, 160),
    title: line(e.title, 200),
    problem: clean(e.problem, 4000),
    method: clean(e.method, 4000),
    results: clean(e.results, 4000),
    learning: clean(e.learning, 4000),
    team: clean(e.team, 600),
    pdf_path: line(e.pdf_path, 120) || null,
    photo_path: line(e.photo_path, 120) || null,
    utm: utm(b)
  };
  if (!CATEGORY_NAMES[entry.category]) return fail(res, 'Please choose a category.');
  const missing = requireFields(entry, [
    ['name', 'Please enter your full name.'], ['qualification', 'Please enter your qualifications.'],
    ['reg_no', 'Please enter your medical registration number.'], ['council', 'Please choose your medical council.'],
    ['city', 'Please enter your city.'], ['title', 'Please give your entry a title.'],
    ['problem', 'Please describe the problem.'], ['method', 'Please describe what was done.'],
    ['results', 'Please give the results.'], ['learning', 'Please say what other doctors can learn.']
  ]);
  if (missing) return fail(res, missing);
  if (!entry.phone) return fail(res, 'That mobile number does not look right. Indian numbers are 10 digits.');
  if (!EMAIL.test(entry.email)) return fail(res, 'That email address does not look right.');
  if (!entry.pdf_path) return fail(res, 'Please upload your supporting PDF.');
  const total = words(entry.problem) + words(entry.method) + words(entry.results) + words(entry.learning);
  if (total > 520) return fail(res, 'The summary is ' + total + ' words. Please keep it within 500.');
  if (entry.young) {
    if (!entry.qual_year || entry.qual_year < YOUNG_FROM_YEAR || entry.qual_year > 2026) {
      return fail(res, 'For the Young Changemaker Award your highest qualification must be from ' + YOUNG_FROM_YEAR + ' or later.');
    }
  }
  const d = e.declarations || {};
  const decl = { own_work: !!d.own_work, deidentified: !!d.deidentified, consent_ethics: !!d.consent_ethics, no_conflict: !!d.no_conflict, rules: !!d.rules };
  if (!Object.values(decl).every(Boolean)) return fail(res, 'Please tick all five declarations.');
  entry.declarations = Object.assign(decl, { at: new Date().toISOString() });

  const made = await callAward({ action: 'create_entry', entry });
  if (!made.ok || !made.data.id) return fail(res, made.data.error || 'Could not save your entry. Please try again.', made.status || 502);
  const { id, ref } = made.data;

  const customer = { name: entry.name, email: entry.email, contact: entry.phone };
  let link;
  try {
    const r = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') },
      body: JSON.stringify({
        amount: FEE_RUPEES * 100,
        currency: 'INR',
        accept_partial: false,
        reference_id: ref,
        description: 'Diabesity Changemakers Award 2026, entry fee (' + ref + ')',
        customer,
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { purpose: 'Diabesity Changemakers Award 2026 entry fee', entry_ref: ref, category: CATEGORY_NAMES[entry.category], applicant: entry.name, registration: entry.reg_no },
        callback_url: SITE + '/api/award-return',
        callback_method: 'get'
      })
    });
    link = await r.json();
    if (!r.ok || !link.id || !link.short_url) {
      return fail(res, (link && link.error && link.error.description) || 'The payment gateway did not accept the request. Your entry ' + ref + ' is saved; please try again or write to us.', 502);
    }
  } catch (err) {
    return fail(res, 'Could not reach the payment gateway. Please try again.', 502);
  }
  await callAward({ action: 'set_link', id, link_id: link.id, amount: FEE_RUPEES * 100 });
  return send(res, 200, { url: link.short_url, ref });
}

async function nominate(b, res) {
  if (Date.now() > ENTRIES_CLOSE) return fail(res, 'Nominations for 2026 closed on 26 October.');
  const n = b.nomination || {};
  if (line(n.website, 60)) return fail(res, 'Rejected.');
  const row = {
    nominator_name: line(n.nominator_name, 120),
    nominator_phone: normalisePhone(n.nominator_phone),
    nominator_email: line(n.nominator_email, 160),
    relation: line(n.relation, 40),
    city: line(n.city, 80),
    doctor_name: line(n.doctor_name, 120),
    doctor_place: line(n.doctor_place, 200),
    doctor_city: line(n.doctor_city, 80),
    since_year: Number(n.since_year) || null,
    story: clean(n.story, 5000),
    consent: !!n.consent,
    utm: utm(b)
  };
  const missing = requireFields(row, [
    ['nominator_name', 'Please enter your name.'], ['relation', 'Please tell us who you are to the patient.'],
    ['doctor_name', 'Please enter the doctor’s name.'], ['doctor_place', 'Please enter the hospital or clinic.'],
    ['doctor_city', 'Please enter the doctor’s city.']
  ]);
  if (missing) return fail(res, missing);
  if (!row.nominator_phone) return fail(res, 'That mobile number does not look right. We will call you on it to hear your story.');
  if (row.nominator_email && !EMAIL.test(row.nominator_email)) return fail(res, 'That email address does not look right. You can leave it blank.');
  if (words(row.story) < 30) return fail(res, 'Please tell us a little more, at least 30 words, about how the doctor helped.');
  if (!row.consent) return fail(res, 'Please tick the box so that we may call you.');
  if (!row.nominator_email) row.nominator_email = null;

  const made = await callAward({ action: 'create_nomination', nomination: row });
  if (!made.ok || !made.data.ref) return fail(res, made.data.error || 'Could not save your nomination. Please try again.', made.status || 502);
  await alert('Award nomination ' + made.data.ref + ': Dr ' + row.doctor_name.replace(/^dr\.?\s*/i, ''), {
    Reference: made.data.ref, Doctor: row.doctor_name, Where: row.doctor_place + ', ' + row.doctor_city,
    NominatedBy: row.nominator_name + ' (' + row.relation + ')', Phone: row.nominator_phone,
    Email: row.nominator_email || 'not given', Story: row.story
  }, '/award-nominate');
  return send(res, 200, { ref: made.data.ref });
}

async function juror(b, res) {
  if (Date.now() > JURY_CLOSE) return fail(res, 'Jury applications closed on 18 October.');
  const j = b.juror || {};
  if (line(j.website, 60)) return fail(res, 'Rejected.');
  const EXP = ['Clinical diabetology', 'Obesity medicine', 'Endocrinology', 'Internal medicine', 'Paediatric diabetes', 'Public health or epidemiology', 'Biostatistics or research methods', 'Medical education'];
  const row = {
    name: line(j.name, 120),
    qualification: line(j.qualification, 160),
    speciality: line(j.speciality, 120),
    reg_no: line(j.reg_no, 40),
    council: line(j.council, 120),
    designation: line(j.designation, 160),
    institution: line(j.institution, 200),
    city: line(j.city, 80),
    state: line(j.state, 60),
    pg_year: Number(j.pg_year) || null,
    phone: normalisePhone(j.phone),
    email: line(j.email, 160),
    expertise: Array.isArray(j.expertise) ? j.expertise.filter((x) => EXP.includes(x)) : [],
    roles: clean(j.roles, 2000),
    conflicts: clean(j.conflicts, 1000),
    linkedin: line(j.linkedin, 200),
    cv_path: line(j.cv_path, 120) || null,
    utm: utm(b)
  };
  const missing = requireFields(row, [
    ['name', 'Please enter your full name.'], ['qualification', 'Please enter your qualifications.'],
    ['designation', 'Please enter your current designation.'], ['institution', 'Please enter your institution.'],
    ['city', 'Please enter your city.']
  ]);
  if (missing) return fail(res, missing);
  if (!row.pg_year || row.pg_year < 1960 || row.pg_year > 2026) return fail(res, 'Please enter the year of your postgraduate qualification.');
  if (!row.phone) return fail(res, 'That mobile number does not look right.');
  if (!EMAIL.test(row.email)) return fail(res, 'That email address does not look right.');
  if (!row.expertise.length) return fail(res, 'Please choose at least one area of expertise.');
  if (!row.cv_path) return fail(res, 'Please upload your CV as a PDF.');
  const d = j.declarations || {};
  const decl = { not_entering: !!d.not_entering, conflicts: !!d.conflicts, time: !!d.time, confidential: !!d.confidential };
  if (!Object.values(decl).every(Boolean)) return fail(res, 'Please tick all four declarations.');
  row.declarations = Object.assign(decl, { at: new Date().toISOString() });

  const made = await callAward({ action: 'create_juror', juror: row });
  if (!made.ok || !made.data.ref) return fail(res, made.data.error || 'Could not save your application. Please try again.', made.status || 502);
  await alert('Jury application ' + made.data.ref + ': ' + row.name, {
    Reference: made.data.ref, Name: row.name, Qualification: row.qualification, Designation: row.designation + ', ' + row.institution,
    City: row.city, PGYear: row.pg_year, Expertise: row.expertise.join(', '), Phone: row.phone, Email: row.email
  }, '/award-jury');
  return send(res, 200, { ref: made.data.ref });
}

async function desk(b, res) {
  const op = String(b.op || '');
  if (!['status', 'setup', 'list', 'update', 'file', 'change-passcode'].includes(op)) return fail(res, 'Unknown operation.');
  const r = await callAward({
    action: 'admin', op, passcode: String(b.passcode || '').slice(0, 200),
    table: b.table, id: b.id, fields: b.fields, path: b.path, next: b.next
  });
  res.setHeader('Cache-Control', 'no-store');
  return send(res, r.ok ? 200 : r.status, r.data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 'Method not allowed', 405); }
  const b = body(req);
  switch (String((req.query && req.query.op) || '')) {
    case 'upload': return upload(b, res);
    case 'apply': return apply(b, res);
    case 'nominate': return nominate(b, res);
    case 'juror': return juror(b, res);
    case 'desk': return desk(b, res);
  }
  return fail(res, 'Unknown operation.', 404);
}
