// Single endpoint behind google.script.run:  POST /api/rpc  { fn: "sendInstantPaymentEmail", args: [ ... ] }
// Every call needs the user's Supabase access token (Authorization: Bearer ...).
const { authenticate } = require('../lib/auth');

// name -> { run(args, user), roles?: [..] }   (roles = restrict to these roles; omit = any signed-in active user)
const HANDLERS = {
  uploadFileToDrive: { run: (a) => require('../lib/drive').uploadFileToDrive(a[0], a[1], a[2], a[3]) },
  notifyCustomerLeadCreated: { run: (a) => require('../lib/whatsapp').notifyCustomerLeadCreated(a[0], a[1]) },
  sendCallingWhatsApp: { run: (a, u) => {
    if (!(['Admin', 'Head', 'Back Office Head', 'CRE'].includes(u.role) || u.calling_access)) throw new Error('Not allowed.');
    return require('../lib/whatsapp').sendCallingWhatsApp(a[0], a[1]);
  } },
  sendInstantPaymentEmail: { run: (a) => require('../lib/mail').sendInstantPaymentEmail(a[0]) },
  sendPaymentNotificationEmail: { run: (a) => require('../lib/mail').sendPaymentNotificationEmail(a[0]) },
  sendAccessoriesDeductionReviewEmail: { run: (a) => require('../lib/mail').sendAccessoriesDeductionReviewEmail(a[0]) },
  sendManifestPaymentEmail: { run: (a) => require('../lib/mail').sendManifestPaymentEmail(a[0]) },
  sendManifestRequestEmail: { run: (a) => require('../lib/mail').sendManifestRequestEmail(a[0]) },
  createSupabaseUser: { roles: ['Admin'], run: (a) => require('../lib/admin').createSupabaseUser(a[0], a[1], a[2], a[3], a[4], a[5], a[6]) },
  // Sheets.gs is intentionally not part of the Node version
  writeSentForPaymentToSheet: { run: () => { throw new Error('Google Sheet export is not available in the Node version (use Download Excel/CSV).'); } },
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }
  try {
    const user = await authenticate(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const h = Object.prototype.hasOwnProperty.call(HANDLERS, body.fn) ? HANDLERS[body.fn] : null;
    if (!h) { res.status(404).json({ ok: false, error: 'Unknown function: ' + body.fn }); return; }
    if (h.roles && !h.roles.includes(user.role)) { res.status(403).json({ ok: false, error: 'Not allowed.' }); return; }
    const result = await h.run(Array.isArray(body.args) ? body.args : [], user);
    res.status(200).json({ ok: true, result: result === undefined ? null : result });
  } catch (e) {
    console.error('rpc error:', e && e.message);
    res.status(e.status || 500).json({ ok: false, error: (e && e.message) || String(e) });
  }
};
