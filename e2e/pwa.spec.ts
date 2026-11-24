import { chromium, expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { card, importSynthetic, nav, openFresh } from './helpers';

test('GitHub Pages alt dizini: manifest, service worker ve statik dosyalar', async ({ page, request, baseURL }) => {
  await openFresh(page);
  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifestHref).toContain('/growtech-otobus/');
  const manifest = await (await request.get(new URL(manifestHref!, baseURL).toString())).json();
  expect(manifest.start_url).toBe('/growtech-otobus/');
  expect(manifest.scope).toBe('/growtech-otobus/');
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, new URL(manifestHref!, baseURL)).toString());
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  for (const p of ['sw.js', 'favicon.svg', 'apple-touch-icon.png']) expect((await request.get(p)).status(), p).toBe(200);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/growtech-otobus\/$/);
});

test('çevrimdışı: arama, ekleme, düzenleme, otobüs ve yoklama çalışır', async ({ page, context }) => {
  await openFresh(page);
  await importSynthetic(page);
  // Service worker'ın kontrolü almasını bekle
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await nav(page, 'Ayarlar');
  await expect(page.getByTestId('offline-status')).toContainText('çevrimdışı kullanıma hazır');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'GROWTECH 2026' })).toBeVisible();
  await expect(page.getByText('Çevrimdışı', { exact: true })).toBeVisible();
  await nav(page, 'Katılımcılar');
  await page.getByLabel('Katılımcı ara').fill('cagri');
  await card(page, 'ÇAĞRI ÖRNEKOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
  await page.getByLabel('Katılımcı ara').fill('');
  await page.getByRole('button', { name: 'Yeni Katılımcı' }).click();
  await page.getByRole('dialog').getByLabel('Ad soyad').fill('ÇEVRİMDIŞI EKLENEN');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await card(page, 'ÇEVRİMDIŞI EKLENEN').getByRole('button', { name: /bilgilerini düzelt/ }).click();
  await page.getByRole('dialog').getByLabel('Biniş yeri').fill('KÖŞK');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await nav(page, 'Otobüsüm');
  await expect(page.getByTestId('bus-row')).toHaveCount(2);
  await nav(page, 'Yoklama');
  await page.getByRole('checkbox', { name: /ÇEVRİMDIŞI EKLENEN/ }).click();
  await expect(page.getByTestId('att-boarded')).toHaveText('1');
  // Çevrimdışıyken yenile: kayıtlar duruyor
  await page.reload();
  await expect(page.getByTestId('sum-bus')).toHaveText('2');
  await expect(page.getByTestId('sum-boarded')).toHaveText('1');
  await context.setOffline(false);
});

test('tarayıcı kapatılıp yeniden açıldığında veriler korunur', async ({ baseURL }) => {
  const dir = mkdtempSync(join(tmpdir(), 'growtech-pw-'));
  try {
    let ctx = await chromium.launchPersistentContext(dir, { baseURL, viewport: { width: 390, height: 844 } });
    let page = ctx.pages()[0] ?? (await ctx.newPage());
    await openFresh(page);
    await importSynthetic(page);
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Yoklama');
    await page.getByRole('checkbox', { name: /AYŞE/ }).click();
    await expect(page.getByTestId('sum-boarded')).toHaveText('1');
    await ctx.close();

    ctx = await chromium.launchPersistentContext(dir, { baseURL, viewport: { width: 390, height: 844 } });
    page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('./');
    await expect(page.getByTestId('sum-total')).toHaveText('13');
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(page.getByTestId('sum-boarded')).toHaveText('1');
    await ctx.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
