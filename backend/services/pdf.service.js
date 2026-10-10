import puppeteer from 'puppeteer-core';

/**
 * Rendu PDF via le Chrome système (headless) — aucun binaire à télécharger.
 * Le HTML fourni est une page autonome ; les chemins `/uploads/…` sont
 * résolus via la balise <base> vers le serveur local.
 */
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const BASE_URL = `http://127.0.0.1:${process.env.PORT || 5020}`;

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'],
    });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/** Convertit un document HTML autonome en buffer PDF (format A4). */
export async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await page.close().catch(() => {});
  }
}

/** Document HTML de base (base href → résout /uploads/…). */
export function pdfDocument(innerHtml, css) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<base href="${BASE_URL}/">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${css}
</style>
</head>
<body>${innerHtml}</body>
</html>`;
}
