import { expect, test } from '@playwright/test';
import { card, importSynthetic, nav, openFresh, syntheticXlsx } from './helpers';

const deleteBtn = (name: string) => `${name} kişisini sil`;

test.describe('katılımcı silme', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await importSynthetic(page);
  });

  test('onay penceresi adı gösterir; Vazgeç silmez', async ({ page }) => {
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: deleteBtn('AYŞE TESTOĞLU') }).click();
    const dialog = page.getByRole('dialog', { name: 'Katılımcı silinsin mi?' });
    await expect(dialog.getByTestId('delete-name')).toHaveText('AYŞE TESTOĞLU');
    await dialog.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(card(page, 'AYŞE TESTOĞLU')).toBeVisible();
    await expect(page.getByTestId('sum-total')).toHaveText('13');
  });

  test('silme: listeden, otobüsten ve yoklama sayaçlarından kaldırır; aynı firma korunur; kalıcıdır', async ({ page }) => {
    for (const n of ['İSMAİL DENEME', 'ŞULE ÖRNEK', 'ÇAĞRI ÖRNEKOĞLU']) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Yoklama');
    await page.getByRole('checkbox', { name: /İSMAİL DENEME/ }).click();
    await page.getByRole('checkbox', { name: /ÇAĞRI/ }).click();
    await expect(page.getByTestId('sum-boarded')).toHaveText('2');

    await nav(page, 'Katılımcılar');
    await card(page, 'İSMAİL DENEME').getByRole('button', { name: deleteBtn('İSMAİL DENEME') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(card(page, 'İSMAİL DENEME')).toHaveCount(0);
    await expect(card(page, 'ŞULE ÖRNEK')).toBeVisible(); // aynı firma
    await expect(page.getByTestId('sum-total')).toHaveText('12');
    await expect(page.getByTestId('sum-bus')).toHaveText('2');
    await expect(page.getByTestId('sum-boarded')).toHaveText('1');
    await expect(page.getByTestId('sum-waiting')).toHaveText('1');

    await nav(page, 'Yoklama');
    await expect(page.getByTestId('att-row')).toHaveCount(2);
    await expect(page.getByTestId('att-row').filter({ hasText: 'İSMAİL' })).toHaveCount(0);

    // Uygulama yeniden açıldığında silinen kişi geri gelmez
    await page.reload();
    await expect(page.getByTestId('sum-total')).toHaveText('12');
    await nav(page, 'Katılımcılar');
    await page.getByLabel('Katılımcı ara').fill('ismail');
    await expect(page.getByTestId('participant-card')).toHaveCount(0);
  });

  test('10 saniyelik Geri al kişiyi ve otobüs kaydını geri getirir', async ({ page }) => {
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: deleteBtn('AYŞE TESTOĞLU') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByTestId('sum-total')).toHaveText('12');
    await page.waitForTimeout(7000); // 7. saniyede hâlâ geri alınabilir
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(page.getByTestId('sum-total')).toHaveText('13');
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsümde' })).toBeVisible();
  });

  test('Geri al seçeneği 10 saniye sonra kaybolur', async ({ page }) => {
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: deleteBtn('AYŞE TESTOĞLU') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Geri al' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Geri al' })).toHaveCount(0, { timeout: 11_500 });
    await expect(page.getByTestId('sum-total')).toHaveText('12');
  });

  test('yeni Excel yüklemesinde silinen kişi geri eklenmez; Ayarlar’dan geri getirilebilir', async ({ page }) => {
    await card(page, 'ÇAĞRI ÖRNEKOĞLU').getByRole('button', { name: deleteBtn('ÇAĞRI ÖRNEKOĞLU') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByTestId('sum-total')).toHaveText('12');

    await nav(page, 'Ayarlar');
    await page.getByRole('button', { name: 'Excel yükle' }).click();
    await page.getByTestId('excel-input').setInputFiles(syntheticXlsx());
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByTestId('plan-new')).toHaveText('0');
    await expect(page.getByTestId('plan-deleted')).toHaveText('1');
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('sum-total')).toHaveText('12');

    await nav(page, 'Ayarlar'); // içe aktarma sonrası uygulama Katılımcılar ekranına döner
    const show = page.getByText('Listeyi göster');
    await show.evaluate((el) => el.scrollIntoView({ block: 'center' })); // alttaki bildirimlerin altında kalmasın
    await show.click();
    await page.getByTestId('deleted-row').filter({ hasText: 'ÇAĞRI ÖRNEKOĞLU' }).getByRole('button', { name: 'Geri getir' }).click();
    await expect(page.getByTestId('sum-total')).toHaveText('13');
  });

  test('Otobüsüm: Sil kişiyi siler, Çıkar yalnızca otobüsten çıkarır', async ({ page }) => {
    for (const n of ['AYŞE TESTOĞLU', 'DUYGU SİCİLSİZ']) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Otobüsüm');
    await page.getByRole('button', { name: 'DUYGU SİCİLSİZ listeden çıkar' }).click();
    await expect(page.getByTestId('bus-row')).toHaveCount(1);
    await expect(page.getByTestId('sum-total')).toHaveText('13'); // kişi silinmedi

    await page.getByRole('button', { name: deleteBtn('AYŞE TESTOĞLU') }).click();
    await expect(page.getByRole('dialog').getByTestId('delete-name')).toHaveText('AYŞE TESTOĞLU');
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByText('Otobüs listeniz boş')).toBeVisible();
    await expect(page.getByTestId('sum-total')).toHaveText('12');
  });
});

test('çevrimdışı silme ve geri alma', async ({ page, context }) => {
  await openFresh(page);
  await importSynthetic(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: deleteBtn('AYŞE TESTOĞLU') }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
  await expect(page.getByTestId('sum-total')).toHaveText('12');
  await card(page, 'DUYGU SİCİLSİZ').getByRole('button', { name: deleteBtn('DUYGU SİCİLSİZ') }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
  await expect(page.getByTestId('sum-total')).toHaveText('11');
  await page.getByRole('status').filter({ hasText: 'DUYGU SİCİLSİZ silindi' }).getByRole('button', { name: 'Geri al' }).click();
  await expect(page.getByTestId('sum-total')).toHaveText('12');
  await page.reload();
  await expect(page.getByTestId('sum-total')).toHaveText('12');
  await expect(card(page, 'DUYGU SİCİLSİZ')).toBeVisible();
  await expect(card(page, 'AYŞE TESTOĞLU')).toHaveCount(0);
  await context.setOffline(false);
});
