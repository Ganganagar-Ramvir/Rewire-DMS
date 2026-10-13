// Vercel Cron — 09:00 IST daily (03:30 UTC): yesterday's Part Sold + Scrap Sold emails.
module.exports = async (req, res) => {
  if (process.env.CRON_SECRET && req.headers['authorization'] !== 'Bearer ' + process.env.CRON_SECRET) { res.status(401).json({ ok: false }); return; }
  const out = await require('../../lib/salereports').sendDailySaleReports();
  res.status(200).json({ ok: true, ...out });
};
