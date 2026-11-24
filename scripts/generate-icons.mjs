// public/favicon.svg dosyasından PWA PNG ikonlarını üretir (Playwright Chromium ile).
// Kullanım: npm run icons
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'pwa-192x192.png', size: 192, pad: 0, square: false },
  { file: 'pwa-512x512.png', size: 512, pad: 0, square: false },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, square: true },
  { file: 'maskable-512x512.png', size: 512, pad: 0.12, square: true },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const icon = (t.square ? svg.replace('rx="112"', 'rx="0"') : svg).replace('<svg ', `<svg width="${inner}" height="${inner}" `);
  const bg = t.square ? '#123B32' : 'transparent';
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${bg}"><div style="width:${t.size}px;height:${t.size}px;display:grid;place-items:center">${icon}</div></body></html>`,
  );
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${t.file}`, import.meta.url)), omitBackground: !t.square });
  await page.close();
  console.log('✓', t.file);
}
await browser.close();
