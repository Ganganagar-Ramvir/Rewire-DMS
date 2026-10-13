// Email (replaces GmailApp.sendEmail) — SMTP via nodemailer.
const nodemailer = require('nodemailer');

let _t = null;
function transport() {
  if (_t) return _t;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).');
  const port = Number(process.env.SMTP_PORT || 465);
  _t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return _t;
}

// opts: { to, cc, subject, text, html, attachments:[{filename, content, contentType}] }
async function sendMail(opts) {
  const name = process.env.MAIL_FROM_NAME || 'REWIRE DMS';
  return transport().sendMail({
    from: `"${name}" <${process.env.SMTP_USER}>`,
    to: opts.to, cc: opts.cc, subject: opts.subject, text: opts.text, html: opts.html, attachments: opts.attachments,
  });
}

const todayIN = () => new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

// ---- Instant Payment (Price Negotiation) ----
async function sendInstantPaymentEmail(p) {
  const to = ['accounts.Rewire@gnmotors.net', 'cash.kota@gnmotors.net', 'puneet.chaudhary@gnmotors.net', 'delhi.rewire@gnmotors.net'];
  const cc = ['rahul.sharma@gnmotors.net', 'saurav.sharma@gnmotors.net', 'sourabh@gnmotors.net', 'nikhil.goel@gnmotors.net', 'praveen.bhati@gnmotors.net'];
  const subject = 'INSTANT PAYMENT | ' + (p.customerName || '') + ' | ' + (p.leadNo || '') + ' | ' + (p.vehicleNumber || '');
  const l = [];
  l.push('Dear Sir,', '', 'Please upload instant payment as per following details from HDFC - ENET subjected to approval from any one of the following:-', '',
    '1. Mr Rahul Sharma (Plant Head)', '2. Mr Mohan (Accounts - REWIRE)', '3. Mr Saurabh Agarwal (Director)', '');
  if (p.toParty === 'Customer' || p.toParty === 'Both') {
    l.push('Customer Name: ' + (p.customerName || '—'), 'Bank Account Number: ' + ((p.customerBank && p.customerBank.acct) || '—'),
      'IFSC Code: ' + ((p.customerBank && p.customerBank.ifsc) || '—'), 'Customer Amount: ' + (p.customerAmount || 0), '');
  }
  if (p.toParty === 'Broker' || p.toParty === 'Both') {
    l.push('Broker Name: ' + ((p.brokerBank && p.brokerBank.holder) || p.brokerName || '—'), 'Bank Account Number: ' + ((p.brokerBank && p.brokerBank.acct) || '—'),
      'IFSC Code: ' + ((p.brokerBank && p.brokerBank.ifsc) || '—'), 'Broker Payment: ' + (p.brokerAmount || 0), '');
  }
  l.push('Vehicle Number: ' + (p.vehicleNumber || '—'), 'Vehicle Model: ' + (p.vehicleModel || '—'), '', 'Regards,', 'REWIRE', p.senderName || '');
  await sendMail({ to: to.join(','), cc: cc.join(','), subject, text: l.join('\n') });
  return true;
}

// ---- "Send for Payment" batch -> Bank/Cashier (CSV attached) ----
async function sendPaymentNotificationEmail(payload) {
  const to = ['cash.kota@gnmotors.net'];
  const cc = ['sourabh@gnmotors.net', 'rahul.sharma@gnmotors.net', 'saurav.sharma@gnmotors.net', 'praveen.bhati@gnmotors.net', 'accounts.Rewire@gnmotors.net'];
  const count = payload.count || 0;
  const subject = 'SEND FOR PAYMENT | ' + count + ' payment(s) | ' + todayIN();
  const body = ['Dear Sir,', '', 'Please process the ' + count + ' payment(s) as per the attached NEFT/RTGS file.', '', 'Regards,', 'REWIRE', payload.senderName || ''];
  await sendMail({ to: to.join(','), cc: cc.join(','), subject, text: body.join('\n'),
    attachments: [{ filename: 'Send_for_Payment_' + Date.now() + '.csv', content: payload.csvContent || '', contentType: 'text/csv' }] });
  return true;
}

// ---- Accessories deduction -> Manager review ----
async function sendAccessoriesDeductionReviewEmail(p) {
  if (!p.managerEmail) throw new Error('No manager email.');
  const subject = 'ACCESSORIES DEDUCTION — REVIEW NEEDED | ' + (p.customerName || '') + ' | ' + (p.leadNo || '') + ' | ' + (p.vehicleNumber || '');
  const l = ['Dear ' + (p.managerName || 'Sir') + ',', '',
    'An Accessories Check deduction has been recorded for the following vehicle and needs your review before it goes to Head Approval:', '',
    'Lead No.: ' + (p.leadNo || '—'), 'Customer Name: ' + (p.customerName || '—'), 'Vehicle Number: ' + (p.vehicleNumber || '—'),
    'Deduction Amount: ₹' + (p.deductionAmount || 0), 'Reason: ' + (p.deductionReason || '—'), '',
    'Please open REWIRE DMS -> Accessories Review to add your remarks and send it on to Head Approval.', '', 'Regards,', 'REWIRE DMS'];
  await sendMail({ to: p.managerEmail, subject, text: l.join('\n') });
  return true;
}

// ---- Logistics manifest payment -> Cashier ----
async function sendManifestPaymentEmail(payload) {
  const to = ['cash.kota@gnmotors.net'];
  const cc = ['sourabh@gnmotors.net', 'rahul.sharma@gnmotors.net', 'saurav.sharma@gnmotors.net', 'praveen.bhati@gnmotors.net', 'accounts.Rewire@gnmotors.net'];
  const subject = 'SEND FOR PAYMENT | ' + payload.manifestNo + ' | ' + (payload.transporter || '');
  const body = ['Dear Sir,', '', 'Please process the following logistics payment as per the attached NEFT/RTGS file.', '',
    'Manifest No.: ' + payload.manifestNo, 'Transporter: ' + (payload.transporter || '—'), 'Bill No.: ' + (payload.billNo || '—'),
    'Amount Payable: ' + payload.amount, '', 'Regards,', 'REWIRE', payload.senderName || ''];
  await sendMail({ to: to.join(','), cc: cc.join(','), subject, text: body.join('\n'),
    attachments: [{ filename: 'Manifest_Payment_' + String(payload.manifestNo).replace(/\//g, '_') + '.csv', content: payload.csvContent || '', contentType: 'text/csv' }] });
  return true;
}

// ---- Transportation request (send slip as PDF) ----
async function sendManifestRequestEmail(payload) {
  const { htmlToPdf } = require('./pdf');
  const pdf = await htmlToPdf(payload.html);
  const body = ['Dear Sir,', '', 'A new Transportation Request has been raised.', '',
    'Manifest No.: ' + payload.manifestNo, 'Transport Mode: ' + (payload.mode || '—'),
    (payload.subjectExtra ? 'Carrier: ' + payload.subjectExtra : ''),
    'From: ' + (payload.from || '—') + '  →  To: ' + (payload.to || '—'), 'Vehicles: ' + (payload.vehicles || '—'), '',
    'The send slip is attached.', '', 'Regards,', 'REWIRE DMS'];
  await sendMail({ to: 'ramvir.kumar@gnmotors.net', subject: 'TRANSPORTATION REQUEST | ' + payload.manifestNo + ' | ' + (payload.mode || ''), text: body.join('\n'),
    attachments: [{ filename: 'Manifest_' + String(payload.manifestNo).replace(/\//g, '_') + '_Send_Slip.pdf', content: pdf, contentType: 'application/pdf' }] });
  const result = { email: true, whatsapp: null };
  if (payload.driverPhone) result.whatsapp = { ok: false, reason: 'WhatsApp API not configured yet' };   // same placeholder as the Apps Script version
  return result;
}

module.exports = { sendMail, sendInstantPaymentEmail, sendPaymentNotificationEmail, sendAccessoriesDeductionReviewEmail, sendManifestPaymentEmail, sendManifestRequestEmail };
