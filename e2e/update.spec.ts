import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { card, importSynthetic, nav, openFresh } from './helpers';

const build = (tag?: string) =>
  execSync('npx vite build', { env: { ...process.env, APP_BUILD_TAG: tag ?? '' }, stdio: 'pipe', timeout: 120_000 });

test.describe.configure({ mode: 'serial' });

// Bu dosya dist/ klasörünü yeniden üretir; testten sonra normal build geri yüklenir.
test.afterAll(() => build());

test('yeni sürüm yayınlandığında açık uygulama kendini günceller, kayıtlar korunur', async ({ page }) => {
  test.setTimeout(120_000);
  await openFresh(page);
  await importSynthetic(page);
  await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
  await expect(page.getByTestId('sum-bus')).toHaveText('1'); // kayıt tamamlandı
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await nav(page, 'Ayarlar');
  const before = await page.getByTestId('app-version').innerText();
  expect(before).not.toContain('guncelleme-testi');

  // Sunucuda yeni sürüm yayınlanıyor (GitHub Pages deploy'unun yerel karşılığı)
  build('guncelleme-testi');

  // Uygulama öne geldiğinde güncelleme kontrolü yapılır ve otomatik uygulanır
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText(/Uygulama güncellendi \(v.*guncelleme-testi\)/)).toBeVisible({ timeout: 30_000 });
  await nav(page, 'Ayarlar');
  await expect(page.getByTestId('app-version')).toContainText('guncelleme-testi');
  await expect(page.getByTestId('sum-total')).toHaveText('13');
  await expect(page.getByTestId('sum-bus')).toHaveText('1');
});

test('açık bir pencere varken güncelleme beklenir, kapanınca uygulanır', async ({ page }) => {
  test.setTimeout(120_000);
  build('ilk');
  await openFresh(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Elle katılımcı ekle' }).click();
  await page.getByRole('dialog').getByLabel('Ad soyad').fill('YARIM FORM');

  build('ikinci');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText(/açık pencere kapanınca otomatik yüklenecek/)).toBeVisible({ timeout: 30_000 });
  // Form açıkken sayfa yenilenmedi; yazılan metin duruyor
  await expect(page.getByRole('dialog').getByLabel('Ad soyad')).toHaveValue('YARIM FORM');

  await page.getByRole('dialog').getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText(/Uygulama güncellendi \(v.*ikinci\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('sum-total')).toHaveText('1'); // form kaydedildi, güncelleme sonrası da duruyor
});
