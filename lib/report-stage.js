// Port of describeLeadLocation() (JS-Core.html) — the exact "which stage is this lead stuck at" logic (was in Report.gs).
// If describeLeadLocation() in JS-Core.html changes, change this too.
const REPORT_STAGE_LABELS = ['New Lead', 'Valuation', 'Price Negotiation', 'Bank KYC', 'Upload Delivery', 'Verification & Zoho', 'Manager Approval', 'Accessories Check', 'Head Approval', 'RC Tracking', 'Payment Release'];

const isAlt = (pt) => !!pt && pt !== 'Post Delivery' && pt !== 'Credit';

function reportStageLabel(l) {
  if (l.ud_status === 'Complete' && l.ha_status === 'Approved') return 'Purchased';
  const alt = isAlt(l.pn_payment_type);
  if (alt && l.pn_payment_type !== 'Instant Payments' && l.current_stage === 6 && (l.payment_release_status || 'Pending') === 'Pending') return 'Payment Release';
  if (alt && (!l.ma_status || l.ma_status === 'Pending')) {
    if (l.current_stage === 4 && l.pn_payment_type !== 'Instant Payments') return 'Manager Approval';
    if (l.current_stage === 3) return 'Verification & Zoho';
  }
  if (alt ? (l.kyc_status === 'Complete' && l.ud_status !== 'Complete') : (l.current_stage === 3)) return 'Upload Delivery';
  const maOk = l.ma_status === 'Approved' || l.pn_payment_type === 'Instant Payments';
  const accessoriesDue = alt ? (l.ud_status === 'Complete' && !!l.ud_filled_on) : l.current_stage === 6;
  if (maOk && l.accessories_check_status !== 'Confirmed' && accessoriesDue) return 'Accessories Check';
  if (alt && l.ud_status === 'Complete' && l.ud_filled_on && l.accessories_check_status === 'Confirmed') return 'Head Approval';
  const n = (l.current_stage === null || l.current_stage === undefined) ? 0 : l.current_stage;
  return REPORT_STAGE_LABELS[n + 1] || (l.lead_status || l.overall_status || '—');
}

module.exports = { reportStageLabel };
