// Daily "Yesterday's Sales" emails: Part Sold + Scrap Sold (port of SaleReports.gs).
const { rest } = require('./supabase');
const { sendMail } = require('./mail');

const TO = 'rahul.sharma@gnmotors.net';
const CC = 'Sourabh@gnmotors.net';
const TZ = 'Asia/Kolkata';

function yesterdayRange() {
  const fmt = (d, o) => new Intl.DateTimeFormat('en-CA', Object.assign({ timeZone: TZ }, o)).format(d);
  const now = new Date(), yest = new Date(now.getTime() - 86400000);
  const ymd = (d) => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return {
    label: new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(yest),
    from: ymd(yest) + 'T00:00:00+05:30', to: ymd(now) + 'T00:00:00+05:30',
  };
}
const esc = (v) => String(v === null || v === undefined || v === '' ? '-' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const TD = 'padding:4px 8px;border:1px solid #ddd;';
const TH = 'padding:4px 8px;border:1px solid #ddd;text-align:left;background:#f3f4f6;';
const send = (subject, html, text) => sendMail({ to: TO, cc: CC, subject, html, text });
const tbl = (headers, rows, size) => `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:${size}px;"><tr>${headers.map(h => `<th style="${TH}">${h}</th>`).join('')}</tr>${rows.map(r => '<tr>' + r.map(v => `<td style="${TD}">${esc(v)}</td>`).join('') + '</tr>').join('')}</table>`;
const enc = encodeURIComponent;

async function sendPartSoldDailyEmail() {
  const r = yesterdayRange();
  const challans = await rest('rewire_part_sale_challans?status=eq.Completed&gate_pass_generated_at=gte.' + enc(r.from) + '&gate_pass_generated_at=lt.' + enc(r.to) + '&order=gate_pass_generated_at.asc&select=*');
  const items = {};
  for (const c of challans) items[c.id] = await rest('rewire_part_sale_items?challan_id=eq.' + c.id + '&order=sr_no.asc&select=*');
  const totalAmt = challans.reduce((s, c) => s + Number(c.total_price || 0), 0), totalWt = challans.reduce((s, c) => s + Number(c.total_weight || 0), 0);
  let html = '<p>Dear Sir,</p>', text = 'Dear Sir,\n\n';
  if (!challans.length) { html += `<p>No Part Sold sales were completed on <b>${r.label}</b>.</p>`; text += `No Part Sold sales were completed on ${r.label}.\n`; }
  else {
    html += `<p>Part Sold summary for <b>${r.label}</b>: <b>${challans.length}</b> sale(s), total weight <b>${totalWt} Kg</b>, total amount <b>${money(totalAmt)}</b>.</p>`
      + tbl(['Challan No.', 'Gate Pass No.', 'Customer', 'Phone', 'Invoice No.', 'Invoice Date', 'Payment Mode', 'Weight (Kg)', 'Amount'], challans.map(c => [c.challan_no, c.gate_pass_no, c.customer_name, c.phone, c.invoice_number, c.invoice_date, c.payment_mode, c.total_weight, money(c.total_price)]), 13);
    text += `Part Sold summary for ${r.label}: ${challans.length} sale(s), ${totalWt} Kg, ${money(totalAmt)}\n\n`;
    challans.forEach(c => {
      text += `${c.challan_no} | ${c.gate_pass_no} | ${c.customer_name} | ${money(c.total_price)}\n`;
      html += `<p style="margin:14px 0 4px;"><b>${esc(c.challan_no)}</b> &mdash; ${esc(c.customer_name)}</p>` + tbl(['Sr.', 'Part Number', 'Part Name', 'Weight (Kg)', 'Price'], (items[c.id] || []).map(it => [it.sr_no, it.part_number, it.part_name, it.weight, money(it.price)]), 12);
    });
  }
  html += '<p>Regards,<br/>REWIRE DMS (automated)</p>'; text += '\nRegards,\nREWIRE DMS (automated)';
  await send('REWIRE DMS | Part Sold | Sales of ' + r.label, html, text);
}

async function sendScrapSoldDailyEmail() {
  const r = yesterdayRange();
  const challans = await rest('rewire_scrap_vehicle_challans?status=eq.Invoiced&invoice_filled_on=gte.' + enc(r.from) + '&invoice_filled_on=lt.' + enc(r.to) + '&order=invoice_filled_on.asc&select=*,buyer:rewire_scrap_buyers(company_name,contact_name,mobile)');
  const items = {};
  for (const c of challans) items[c.id] = await rest('rewire_scrap_sale_items?challan_id=eq.' + c.id + '&order=created_at.asc&select=*');
  let grand = 0; challans.forEach(c => (items[c.id] || []).forEach(it => { grand += Number(it.final_amount || 0); }));
  let html = '<p>Dear Sir,</p>', text = 'Dear Sir,\n\n';
  if (!challans.length) { html += `<p>No Scrap Sold sales were invoiced on <b>${r.label}</b>.</p>`; text += `No Scrap Sold sales were invoiced on ${r.label}.\n`; }
  else {
    html += `<p>Scrap Sold summary for <b>${r.label}</b>: <b>${challans.length}</b> sale(s), total amount <b>${money(grand)}</b>.</p>`;
    text += `Scrap Sold summary for ${r.label}: ${challans.length} sale(s), ${money(grand)}\n\n`;
    challans.forEach(c => {
      const its = items[c.id] || [], amt = its.reduce((s, it) => s + Number(it.final_amount || 0), 0), buyer = c.buyer ? (c.buyer.company_name || c.buyer.contact_name) : '-';
      html += `<p style="margin:14px 0 4px;"><b>${esc(c.challan_no)}</b> | Vehicle ${esc(c.vehicle_number)} | Buyer: ${esc(buyer)} | Invoice ${esc(c.invoice_no)} (${esc(c.invoice_date)}) | ${esc(c.payment_type)} | Gate Pass ${esc(c.gate_pass_no)} | <b>${money(amt)}</b></p>`
        + tbl(['Category', 'Sub Category', 'UOM', 'Qty', 'Price / Unit', 'Final Amount'], its.map(it => [it.category, it.sub_category, it.uom, it.qty, money(it.price_per_unit), money(it.final_amount)]), 12);
      text += `${c.challan_no} | ${c.vehicle_number} | ${buyer} | ${c.invoice_no} | ${money(amt)}\n`;
    });
  }
  html += '<p>Regards,<br/>REWIRE DMS (automated)</p>'; text += '\nRegards,\nREWIRE DMS (automated)';
  await send('REWIRE DMS | Scrap Sold | Sales of ' + r.label, html, text);
}

async function sendDailySaleReports() {
  const out = { partSold: 'ok', scrapSold: 'ok' };
  try { await sendPartSoldDailyEmail(); } catch (e) { console.error('Part Sold email failed: ' + e.message); out.partSold = e.message; }
  try { await sendScrapSoldDailyEmail(); } catch (e) { console.error('Scrap Sold email failed: ' + e.message); out.scrapSold = e.message; }
  return out;
}
module.exports = { sendDailySaleReports };
