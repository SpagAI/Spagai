// Render the jobs in a JSON file: [{html, pdf, footer?}]. Jobs with a footer get it on every page.
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    await page.goto('file://' + j.html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: j.pdf,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!j.footer,
      headerTemplate: '<span></span>',
      footerTemplate: j.footer || '<span></span>',
    });
  }
  await browser.close();
})();
