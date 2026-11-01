/**
 * MoneyManager backend: Google Apps Script attached to a Google Sheet.
 *
 * The website talks only to this script. The script:
 *  - creates accounts and stores passwords as salted hashes (never plain text)
 *  - emails 6-digit verification and password-reset codes from your Gmail
 *  - keeps sign-in sessions
 *  - saves each family's plan and score history, and only ever returns a
 *    user's own rows to that user
 *
 * Setup: see README.md, section "Connect Google Sheets".
 * The spreadsheet itself stays private to you; nobody needs access to it.
 */

const APP_NAME = 'MoneyManager';
const ADVISOR_LINE = 'DareToDreams Financial Group · Educational tool, not financial advice';
const CODE_TTL_MIN = 60;          // codes expire after 1 hour
const RESEND_SECONDS = 60;        // minimum wait between code emails
const MAX_CODE_ATTEMPTS = 5;      // wrong guesses before a code is void
const SESSION_DAYS = 30;          // stay signed in for 30 days
const MAX_FAILED_LOGINS = 10;     // then lock sign-in for 15 minutes
const LOCK_MINUTES = 15;
const HASH_ROUNDS = 300;

const SHEETS = {
  Users:    ['email', 'name', 'verified', 'created_at', 'last_login', 'failed_logins', 'locked_until', 'pass_hash', 'salt'],
  Plans:    ['email', 'name', 'updated_at', 'health_score', 'household_income', 'monthly_surplus', 'net_worth', 'protection_gap', 'retirement_gap', 'checkup_step', 'state_json', 'step', 'max_step'],
  Checkups: ['email', 'saved_at', 'score', 'grade', 'protection_gap', 'retirement_gap'],
  Codes:    ['email', 'purpose', 'code_hash', 'expires_at', 'attempts', 'sent_at'],
  Sessions: ['token_hash', 'email', 'created_at', 'expires_at']
};

/* ---------- One-time setup (run from the editor) ---------- */
function setup() {
  ensureSheets_();
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log('MoneyManager is set up. Tabs: ' + Object.keys(SHEETS).join(', ') + '. Emails you can still send today: ' + quota);
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      const h = SHEETS[name];
      sh.appendRow(h);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#0F3D2C').setFontColor('#FFFFFF');
    }
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

/* ---------- Web endpoints ---------- */
function doGet() {
  return json_({ ok: true, app: APP_NAME, message: 'MoneyManager API is running.' });
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'Bad request.' }); }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureSheets_();
    const fn = ACTIONS[req.action];
    if (!fn) return json_({ ok: false, error: 'Unknown action.' });
    return json_(fn(req));
  } catch (err) {
    return json_({ ok: false, error: err && err.userMessage ? err.userMessage : 'Something went wrong on the server. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

const ACTIONS = {
  register: function (r) {
    const email = cleanEmail_(r.email), name = String(r.name || '').trim().slice(0, 120), pw = String(r.password || '');
    if (!name) fail_('Enter your full name.');
    if (pw.length < 8) fail_('Your password needs at least 8 characters.');
    const u = find_('Users', 'email', email);
    if (u && truthy_(u.obj.verified)) fail_('An account with this email already exists. Sign in instead.');
    const salt = newToken_().slice(0, 24);
    const row = { email: email, name: name, verified: false, created_at: now_(), last_login: '', failed_logins: 0, locked_until: '', pass_hash: passHash_(pw, salt), salt: salt };
    if (u) update_('Users', u.row, row); else append_('Users', row);
    sendCode_(email, 'signup', name, true);
    return { ok: true };
  },

  resend: function (r) {
    const email = cleanEmail_(r.email), purpose = r.purpose === 'recovery' ? 'recovery' : 'signup';
    const u = find_('Users', 'email', email);
    if (u) sendCode_(email, purpose, u.obj.name, false);
    return { ok: true };
  },

  verify: function (r) {
    const email = cleanEmail_(r.email);
    const u = find_('Users', 'email', email);
    if (!u) fail_('That code is incorrect or has expired. Check the email or resend a new code.');
    checkCode_(email, 'signup', r.code);
    update_('Users', u.row, { verified: true, last_login: now_(), failed_logins: 0, locked_until: '' });
    return { ok: true, session: newSession_(email, u.obj.name) };
  },

  login: function (r) {
    const email = cleanEmail_(r.email), pw = String(r.password || '');
    const u = find_('Users', 'email', email);
    const bad = 'Email or password is incorrect.';
    if (!u) fail_(bad);
    const lockedUntil = u.obj.locked_until ? new Date(u.obj.locked_until) : null;
    if (lockedUntil && lockedUntil > new Date()) fail_('Too many attempts. Please wait ' + LOCK_MINUTES + ' minutes and try again, or reset your password.');
    if (passHash_(pw, u.obj.salt) !== u.obj.pass_hash) {
      const n = (Number(u.obj.failed_logins) || 0) + 1;
      update_('Users', u.row, { failed_logins: n, locked_until: n >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : '' });
      fail_(bad);
    }
    if (!truthy_(u.obj.verified)) fail_('Email not confirmed');
    update_('Users', u.row, { failed_logins: 0, locked_until: '', last_login: now_() });
    return { ok: true, session: newSession_(email, u.obj.name) };
  },

  forgot: function (r) {
    const email = cleanEmail_(r.email);
    const u = find_('Users', 'email', email);
    if (u && truthy_(u.obj.verified)) sendCode_(email, 'recovery', u.obj.name, true);
    return { ok: true }; // same answer either way, so emails can't be probed
  },

  reset: function (r) {
    const email = cleanEmail_(r.email), pw = String(r.password || '');
    if (pw.length < 8) fail_('Your new password needs at least 8 characters.');
    const u = find_('Users', 'email', email);
    if (!u) fail_('That code is incorrect or has expired. Check the email or resend a new code.');
    checkCode_(email, 'recovery', r.code);
    const salt = newToken_().slice(0, 24);
    update_('Users', u.row, { pass_hash: passHash_(pw, salt), salt: salt, verified: true, failed_logins: 0, locked_until: '', last_login: now_() });
    deleteWhere_('Sessions', function (s) { return s.email === email; }); // sign out other devices
    return { ok: true, session: newSession_(email, u.obj.name) };
  },

  session: function (r) {
    const s = auth_(r.token);
    return { ok: true, session: { token: r.token, email: s.email, name: s.name } };
  },

  logout: function (r) {
    const h = sha_(String(r.token || ''));
    deleteWhere_('Sessions', function (s) { return s.token_hash === h; });
    return { ok: true };
  },

  loadPlan: function (r) {
    const s = auth_(r.token);
    const p = find_('Plans', 'email', s.email);
    let plan = null;
    if (p) {
      let state = {};
      try { state = JSON.parse(p.obj.state_json || '{}'); } catch (x) {}
      plan = { state: state, step: Number(p.obj.step) || 0, max_step: Number(p.obj.max_step) || 0 };
    }
    return { ok: true, plan: plan };
  },

  savePlan: function (r) {
    const s = auth_(r.token);
    const stateJson = JSON.stringify(r.state || {});
    if (stateJson.length > 45000) fail_('Your plan is too large to save.');
    const m = r.summary || {};
    const row = {
      email: s.email, name: String(m.name || s.name || '').slice(0, 120), updated_at: now_(),
      health_score: num_(m.health_score), household_income: num_(m.household_income), monthly_surplus: num_(m.monthly_surplus),
      net_worth: num_(m.net_worth), protection_gap: num_(m.protection_gap), retirement_gap: num_(m.retirement_gap),
      checkup_step: String(m.checkup_step || '').slice(0, 60),
      state_json: stateJson, step: num_(r.step), max_step: num_(r.max_step)
    };
    const p = find_('Plans', 'email', s.email);
    if (p) update_('Plans', p.row, row); else append_('Plans', row);
    return { ok: true };
  },

  listCheckups: function (r) {
    const s = auth_(r.token);
    const rows = all_('Checkups').filter(function (x) { return x.email === s.email; })
      .sort(function (a, b) { return String(b.saved_at).localeCompare(String(a.saved_at)); })
      .slice(0, 8)
      .map(function (x) { return { at: x.saved_at, score: Number(x.score) || 0, grade: x.grade }; });
    return { ok: true, checkups: rows };
  },

  addCheckup: function (r) {
    const s = auth_(r.token);
    const row = { email: s.email, saved_at: now_(), score: num_(r.score), grade: String(r.grade || '').slice(0, 40), protection_gap: num_(r.protection_gap), retirement_gap: num_(r.retirement_gap) };
    append_('Checkups', row);
    return { ok: true, checkup: { at: row.saved_at, score: row.score, grade: row.grade } };
  }
};

/* ---------- Codes & email ---------- */
function sendCode_(email, purpose, name, force) {
  const existing = find_('Codes', 'email', email, function (o) { return o.purpose === purpose; });
  if (existing && !force) {
    const since = (Date.now() - new Date(existing.obj.sent_at).getTime()) / 1000;
    if (since < RESEND_SECONDS) fail_('Please wait a minute before requesting another code.');
  }
  if (MailApp.getRemainingDailyQuota() < 1) fail_("We can't send more emails today. Please try again tomorrow.");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const row = { email: email, purpose: purpose, code_hash: sha_(email + '|' + purpose + '|' + code), expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(), attempts: 0, sent_at: now_() };
  if (existing) update_('Codes', existing.row, row); else append_('Codes', row);

  const isReset = purpose === 'recovery';
  const subject = isReset ? 'Your ' + APP_NAME + ' password reset code: ' + code : 'Your ' + APP_NAME + ' code: ' + code;
  const heading = isReset ? 'Reset your password' : 'Confirm your email';
  const intro = isReset
    ? 'Enter this 6-digit code on the reset screen, then choose a new password.'
    : 'Welcome to ' + APP_NAME + (name ? ', ' + escapeHtml_(String(name).split(' ')[0]) : '') + '! Enter this 6-digit code on the verification screen to finish creating your account.';
  const footer = isReset
    ? "If you didn't ask to reset your password, you can ignore this email. Your password won't change."
    : "If you didn't create a " + APP_NAME + " account, you can ignore this email. No account will be created without this code.";
  MailApp.sendEmail({ to: email, subject: subject, name: APP_NAME, htmlBody: emailHtml_(heading, intro, code, footer),
    body: heading + '\n\n' + intro + '\n\nYour code: ' + code + '\nThis code expires in 1 hour.\n\n' + footer });
}

function checkCode_(email, purpose, code) {
  const wrong = 'That code is incorrect or has expired. Check the email or resend a new code.';
  const c = find_('Codes', 'email', email, function (o) { return o.purpose === purpose; });
  if (!c) fail_(wrong);
  if (new Date(c.obj.expires_at) < new Date()) { deleteRow_('Codes', c.row); fail_(wrong); }
  if ((Number(c.obj.attempts) || 0) >= MAX_CODE_ATTEMPTS) { deleteRow_('Codes', c.row); fail_('Too many attempts. Please request a new code.'); }
  if (sha_(email + '|' + purpose + '|' + String(code || '').trim()) !== c.obj.code_hash) {
    update_('Codes', c.row, { attempts: (Number(c.obj.attempts) || 0) + 1 });
    fail_(wrong);
  }
  deleteRow_('Codes', c.row);
}

function emailHtml_(heading, intro, code, footer) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F0;padding:32px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1A1E1B"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E6E4DC;border-radius:16px">' +
    '<tr><td style="padding:28px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="width:34px;height:34px;background:#0F3D2C;border-radius:8px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-weight:700;font-size:20px;color:#D9B54A">M</td>' +
    '<td style="padding-left:10px;font-family:Georgia,serif;font-size:20px;color:#1A1E1B">' + APP_NAME + '</td></tr></table></td></tr>' +
    '<tr><td style="padding:16px 32px 0"><h1 style="margin:0;font-family:Georgia,serif;font-weight:500;font-size:26px;color:#1A1E1B">' + heading + '</h1>' +
    '<p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#3A3F3B">' + intro + '</p></td></tr>' +
    '<tr><td style="padding:22px 32px"><div style="background:#F6EED7;border:1px solid #E6CF8C;border-radius:12px;padding:18px;text-align:center;font-family:Georgia,serif;font-size:36px;letter-spacing:10px;color:#0F3D2C;font-weight:600">' + code + '</div>' +
    '<p style="margin:12px 0 0;font-size:13px;color:#6C716B;text-align:center">This code expires in 1 hour.</p></td></tr>' +
    '<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.5;color:#6C716B">' + footer + '</td></tr></table>' +
    '<p style="font-size:12px;color:#9A9E97;margin:16px 0 0">' + ADVISOR_LINE + '</p></td></tr></table>';
}

/* ---------- Sessions ---------- */
function newSession_(email, name) {
  const token = newToken_();
  append_('Sessions', { token_hash: sha_(token), email: email, created_at: now_(), expires_at: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() });
  // tidy up expired sessions now and then
  if (Math.random() < 0.1) deleteWhere_('Sessions', function (s) { return new Date(s.expires_at) < new Date(); });
  return { token: token, email: email, name: name || '' };
}

function auth_(token) {
  const h = sha_(String(token || ''));
  const s = token ? find_('Sessions', 'token_hash', h) : null;
  if (!s || new Date(s.obj.expires_at) < new Date()) fail_('Your session has ended. Please sign in again.');
  const u = find_('Users', 'email', s.obj.email);
  return { email: s.obj.email, name: u ? u.obj.name : '' };
}

/* ---------- Sheet helpers ---------- */
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function all_(name) {
  const v = sheet_(name).getDataRange().getValues(), h = v[0], out = [];
  for (let i = 1; i < v.length; i++) { const o = { _row: i + 1 }; h.forEach(function (k, j) { o[k] = v[i][j] instanceof Date ? v[i][j].toISOString() : v[i][j]; }); out.push(o); }
  return out;
}
function find_(name, key, val, extra) {
  const rows = all_(name);
  for (let i = 0; i < rows.length; i++) { const o = rows[i]; if (String(o[key]) === String(val) && (!extra || extra(o))) return { row: o._row, obj: o }; }
  return null;
}
function append_(name, obj) { sheet_(name).appendRow(SHEETS[name].map(function (k) { return obj[k] === undefined ? '' : obj[k]; })); }
function update_(name, row, obj) {
  const sh = sheet_(name), h = SHEETS[name], cur = sh.getRange(row, 1, 1, h.length).getValues()[0];
  h.forEach(function (k, j) { if (obj[k] !== undefined) cur[j] = obj[k]; });
  sh.getRange(row, 1, 1, h.length).setValues([cur]);
}
function deleteRow_(name, row) { sheet_(name).deleteRow(row); }
function deleteWhere_(name, test) {
  const rows = all_(name).filter(test).map(function (o) { return o._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { deleteRow_(name, r); });
}

/* ---------- Small utilities ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(msg) { const e = new Error(msg); e.userMessage = msg; throw e; }
function now_() { return new Date().toISOString(); }
function num_(v) { const n = Number(v); return isFinite(n) ? Math.round(n) : ''; }
function truthy_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function cleanEmail_(e) {
  const s = String(e || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 200) fail_('Enter a valid email address.');
  return s;
}
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function passHash_(pw, salt) { let h = sha_(salt + '|' + pw); for (let i = 0; i < HASH_ROUNDS; i++) h = sha_(h + salt); return h; }
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function escapeHtml_(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
