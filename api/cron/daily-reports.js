// Vercel Cron — 10:00 IST daily (04:30 UTC): manager "pending vehicles" emails + PE WhatsApp summaries.
module.exports = async (req, res) => {
  if (process.env.CRON_SECRET && req.headers['authorization'] !== 'Bearer ' + process.env.CRON_SECRET) { res.status(401).json({ ok: false }); return; }
  const out = await require('../../lib/report').runDailyReports();
  res.status(200).json({ ok: true, ...out });
};
