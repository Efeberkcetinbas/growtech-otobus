import { expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { syntheticRows } from '../tests/fixtures/synthetic';

/** Yapay test Excel'ini bellekte üretir (diske gerçek veri yazılmaz). */
export function syntheticXlsx(rows = syntheticRows()) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'reportUyeListesi');
  return {
    name: 'yapay-test-listesi.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer),
  };
}

/** Tüm istekler yerel sunucuya gitmeli; harici sunucuya veri gönderilmemeli. */
export function trackExternalRequests(page: Page) {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) external.push(req.url());
  });
  return external;
}

export async function openFresh(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'GROWTECH 2026' })).toBeVisible();
}

export async function nav(page: Page, name: 'Katılımcılar' | 'Otobüsüm' | 'Yoklama' | 'Ayarlar') {
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('button', { name }).click();
}

export async function importSynthetic(page: Page, opts: { includeTypo?: boolean } = {}) {
  const empty = page.getByRole('button', { name: 'Excel yükle' }).first();
  if (await empty.isVisible().catch(() => false)) await empty.click();
  else {
    await nav(page, 'Ayarlar');
    await page.getByRole('button', { name: 'Excel yükle' }).click();
  }
  await page.getByTestId('excel-input').setInputFiles(syntheticXlsx());
  await expect(page.getByTestId('import-stats')).toBeVisible();
  if (opts.includeTypo) await page.getByLabel(/Otobüs olarak kabul et/).check();
  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export function card(page: Page, name: string) {
  return page.getByTestId('participant-card').filter({ hasText: name });
}
