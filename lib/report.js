// Daily "Incomplete Process" report to Managers (port of Report.gs) + PE WhatsApp summaries.
const { rest } = require('./supabase');
const { sendMail } = require('./mail');
const { reportStageLabel } = require('./report-stage');
const { sendAllPEPendingSummaries } = require('./whatsapp');

const REPORT_UNASSIGNED_TO = [];   // e.g. ['sourabh@gnmotors.net'] — leads with no manager; empty = skip
const REPORT_CC_LIST = ['sourabh@gnmotors.net', 'rahul.sharma@gnmotors.net', 'plant.rewire@gnmotors.net'];

async function fetchActiveLeads() {
  const select = ['id', 'lead_no', 'customer_name', 'val_vehicle_number', 'current_stage', 'created_at', 'pn_payment_type', 'ma_status', 'ud_status', 'ud_filled_on', 'ha_status',
    'accessories_check_status', 'payment_release_status', 'kyc_status', 'lead_status',
    'pe:rewire_user_profiles!rewire_master_data_pe_id_fkey(name)',
    'manager:rewire_user_profiles!rewire_master_data_manager_id_fkey(id,name,manager_email)'].join(',');
  return rest('rewire_master_data?overall_status=eq.Active&select=' + encodeURIComponent(select) + '&order=manager_id.asc,created_at.asc');
}
const daysPending = (c) => c ? Math.max(0, Math.floor((Date.now() - new Date(c).getTime()) / 86400000)) : '-';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendOneManagerEmail(toEmail, managerName, rows) {
  if (!rows.length) return;
  const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const td = 'padding:4px 8px;border:1px solid #ddd;';
  const htmlRows = rows.map(r => `<tr><td style="${td}">${esc(r.leadNo)}</td><td style="${td}">${esc(r.customer)}</td><td style="${td}">${esc(r.vehicle)}</td><td style="${td}">${esc(r.pe)}</td><td style="${td}">${esc(r.stage)}</td><td style="${td}text-align:center;">${r.days}</td></tr>`).join('');
  const th = (t, c) => `<th style="${td}text-align:${c || 'left'};">${t}</th>`;
  const html = `<p>Dear ${esc(managerName)},</p><p>The following ${rows.length} vehicle(s) under you are still in process (not yet Purchased) as of today:</p>`
    + `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;"><tr style="background:#f3f4f6;">${th('Lead No.')}${th('Customer')}${th('Vehicle No.')}${th('PE')}${th('Pending At Stage')}${th('Days Pending', 'center')}</tr>${htmlRows}</table><p>Regards,<br/>REWIRE DMS (automated)</p>`;
  const text = `Dear ${managerName},\n\nThe following ${rows.length} vehicle(s) under you are still in process:\n\n` + rows.map(r => `${r.leadNo} | ${r.customer} | ${r.vehicle} | PE: ${r.pe} | ${r.stage} | ${r.days} day(s) pending`).join('\n') + '\n\nRegards,\nREWIRE DMS (automated)';
  await sendMail({ to: toEmail, cc: REPORT_CC_LIST.join(','), subject: 'REWIRE DMS | Pending Vehicles Report | ' + managerName + ' | ' + today, text, html });
}

async function sendDailyIncompleteProcessReport() {
  const leads = await fetchActiveLeads();
  const byManager = {}, unassigned = [];
  leads.forEach(l => {
    const row = { leadNo: l.lead_no || '-', customer: l.customer_name || '-', vehicle: l.val_vehicle_number || '-', pe: (l.pe && l.pe.name) || '-', stage: reportStageLabel(l), days: daysPending(l.created_at) };
    if (l.manager && l.manager.id && l.manager.manager_email) {
      (byManager[l.manager.id] = byManager[l.manager.id] || { name: l.manager.name, email: l.manager.manager_email, rows: [] }).rows.push(row);
    } else unassigned.push(row);
  });
  for (const k of Object.keys(byManager)) await sendOneManagerEmail(byManager[k].email, byManager[k].name, byManager[k].rows);
  if (unassigned.length && REPORT_UNASSIGNED_TO.length) await sendOneManagerEmail(REPORT_UNASSIGNED_TO.join(','), 'Unassigned', unassigned);
}

// What the 10 AM cron calls. One job failing does not stop the other.
async function runDailyReports() {
  const out = { managerReport: 'ok', peWhatsApp: 'ok' };
  try { await sendDailyIncompleteProcessReport(); } catch (e) { console.error('Manager email report failed: ' + e.message); out.managerReport = e.message; }
  try { await sendAllPEPendingSummaries(); } catch (e) { console.error('PE WhatsApp summaries failed: ' + e.message); out.peWhatsApp = e.message; }
  return out;
}

module.exports = { runDailyReports, sendDailyIncompleteProcessReport };
