// HTML -> PDF (replaces Utilities.newBlob(html).getAs('application/pdf')) using headless Chromium that runs on Vercel.
async function htmlToPdf(html) {
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    args: chromium.args, defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(), headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(String(html || ''), { waitUntil: 'networkidle0' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } }));
  } finally { await browser.close(); }
}
module.exports = { htmlToPdf };
