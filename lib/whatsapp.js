// WhatsApp via Redlava / Skylight (port of WhatsApp.gs). Same endpoint, same x-api-key / x-phone-id headers.
const { rest } = require('./supabase');
const { reportStageLabel } = require('./report-stage');

const WA_API_BASE = 'https://wa.redlava.in/api/v1/whatsapp/sendMessage';
const WA_TEMPLATE_LEAD_CONFIRMATION = { name: 'customer_lead_registration', language: 'en' };
const WA_TEMPLATE_PE_PENDING_WORK = { name: 'pe_pending_leads_stage', language: 'en' };
// Calling module — separate WhatsApp number + approved template "con" ({{1}} = message typed by the CRE)
const WA_CALLING_PHONE_ID = '1090048374196515';
const WA_TEMPLATE_CALLING = { name: 'con', language: 'en' };
const WA_PE_STAGE_BUCKETS = ['Valuation', 'Price Negotiation', 'Bank KYC', 'Upload Delivery', 'Verification & Zoho', 'Manager Approval'];

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

async function apiCall(payload, phoneIdOverride) {
  const apiKey = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!apiKey) throw new Error('Env WHATSAPP_ACCESS_TOKEN not set.');
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
  const phoneId = phoneIdOverride || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (phoneId) headers['x-phone-id'] = phoneId;
  const resp = await fetch(WA_API_BASE, { method: 'POST', headers, body: JSON.stringify(payload) });
  const text = await resp.text();
  if (!resp.ok) { console.error('WhatsApp API error: ' + text); throw new Error('WhatsApp send failed: ' + text); }
  try { return JSON.parse(text); } catch (e) { return { raw: text }; }
}

function sendTemplate(toPhone, template, vars, phoneIdOverride) {
  return apiCall({ templateName: template.name, language: template.language || 'en', to: normalizePhone(toPhone), templateVariables: (vars || []).map(String) }, phoneIdOverride);
}

const notifyCustomerLeadCreated = (phone, name) => sendTemplate(phone, WA_TEMPLATE_LEAD_CONFIRMATION, [name]);

// Meta rejects newlines/tabs/long space runs inside a template variable
function callingVars(text) {
  const t = String(text || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  if (!t) throw new Error('Message is empty.');
  return [t.substring(0, 900)];
}
const sendCallingWhatsApp = (phone, text) => sendTemplate(phone, WA_TEMPLATE_CALLING, callingVars(text), WA_CALLING_PHONE_ID);

// ---- daily PE pending-work summary ----
async function fetchActiveLeadsForPE(peId) {
  const select = ['id', 'current_stage', 'pn_payment_type', 'ma_status', 'ud_status', 'ud_filled_on', 'ha_status', 'accessories_check_status', 'payment_release_status', 'kyc_status', 'lead_status'].join(',');
  return rest('rewire_master_data?overall_status=eq.Active&pe_id=eq.' + encodeURIComponent(peId) + '&select=' + encodeURIComponent(select));
}
async function countRcPendingForPE(peId) {
  const rows = await rest('rewire_master_data?pe_id=eq.' + encodeURIComponent(peId) + '&ud_status=eq.Complete&ud_rc_received_type=eq.Physical%20RC&overall_status=neq.Closed%20Lost&or=(rc_status.is.null,rc_status.not.ilike.Received%25)&select=id');
  return rows.length;
}
async function sendPEPendingSummary(peId, peName, peNumber) {
  const leads = await fetchActiveLeadsForPE(peId);
  const counts = {}; WA_PE_STAGE_BUCKETS.forEach(b => { counts[b] = 0; });
  leads.forEach(l => { const s = reportStageLabel(l); if (Object.prototype.hasOwnProperty.call(counts, s)) counts[s]++; });
  const rc = await countRcPendingForPE(peId);
  return sendTemplate(peNumber, WA_TEMPLATE_PE_PENDING_WORK, [peName].concat(WA_PE_STAGE_BUCKETS.map(b => String(counts[b]))).concat([String(rc)]));
}
async function sendAllPEPendingSummaries() {
  const pes = await rest('rewire_user_profiles?role=eq.PE&active=eq.true&select=id,name,phone');
  for (const pe of pes) {
    if (!pe.phone) { console.warn('Skipping PE ' + pe.name + ' — no phone number on file.'); continue; }
    try { await sendPEPendingSummary(pe.id, pe.name, pe.phone); }
    catch (e) { console.error('Failed sending PE summary to ' + pe.name + ': ' + e.message); }
  }
}

module.exports = { notifyCustomerLeadCreated, sendCallingWhatsApp, sendPEPendingSummary, sendAllPEPendingSummaries };
