import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { card, finalXlsx, nav, openFresh, pdfText, trackExternalRequests } from './helpers';

async function importFinal(page: Page) {
  await page.getByRole('button', { name: 'Excel yükle' }).first().click();
  await page.getByTestId('excel-input').setInputFiles(await finalXlsx());
  await expect(page.getByTestId('import-stats')).toBeVisible();
}

async function finishImport(page: Page) {
  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

test.describe('güncel Excel: sarı satırlar ve çoklu katılımcılar', () => {
  test('önizleme sayıları; sarı ve otobüs dışı satırlar alınmaz', async ({ page }) => {
    const external = trackExternalRequests(page);
    await openFresh(page);
    await importFinal(page);
    await expect(page.getByTestId('styles-status')).toContainText('Hücre renkleri okundu');
    await expect(page.getByTestId('stat-total')).toHaveText('16');
    await expect(page.getByTestId('stat-yellow')).toHaveText('4');
    await expect(page.getByTestId('stat-bus-all')).toHaveText('11');
    await expect(page.getByTestId('stat-bus-yellow')).toHaveText('1');
    await expect(page.getByTestId('stat-bus')).toHaveText('9');
    await expect(page.getByTestId('stat-people')).toHaveText('15');
    await expect(page.getByTestId('verify-row')).toHaveCount(5);
    // Ad/soyad bölünmüş olabilecek kayıt için birleştirme seçeneği
    await expect(page.getByTestId('verify-row').filter({ hasText: 'ADEM' }).getByLabel('Bu bir kişinin adı soyadı (bölünmesin)')).toBeVisible();
    await finishImport(page);
    await expect(page.getByTestId('sum-total')).toHaveText('15');
    for (const n of ['SARI OTOBÜSÇÜ', 'KENDİ GELEN', 'SPRİNTER YOLCU', 'ŞOFÖR KİŞİ', 'GELMEYEN KİŞİ', 'ULAŞIMI BOŞ']) {
      await expect(card(page, n)).toHaveCount(0);
    }
    expect(external).toEqual([]);
  });

  test('belirsiz isim önizlemede tek kişi olarak birleştirilebilir', async ({ page }) => {
    await openFresh(page);
    await importFinal(page);
    await page.getByTestId('verify-row').filter({ hasText: 'ADEM' }).getByLabel('Bu bir kişinin adı soyadı (bölünmesin)').check();
    await expect(page.getByTestId('stat-people')).toHaveText('14');
    await finishImport(page);
    await expect(card(page, 'ADEM KAYA')).toBeVisible();
    await expect(page.getByTestId('sum-total')).toHaveText('14');
  });

  test('aynı firmadan kişiler ayrı aranır, ayrı otobüse eklenir, biri silinince diğeri kalır', async ({ page }) => {
    await openFresh(page);
    await importFinal(page);
    await finishImport(page);
    const search = page.getByLabel('Katılımcı ara');
    await search.fill('mehmet denemeoglu');
    await expect(page.getByTestId('participant-card')).toHaveCount(1);
    await search.fill('ahmet yapay');
    await expect(page.getByTestId('participant-card')).toHaveCount(1);
    await card(page, 'AHMET YAPAY').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await search.fill('');
    await expect(card(page, 'MEHMET DENEMEOĞLU').getByRole('button', { name: 'Otobüsüme ekle' })).toBeVisible(); // otomatik eklenmedi
    await card(page, 'MEHMET DENEMEOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await expect(page.getByTestId('sum-bus')).toHaveText('2');
    // Ek numara kartta görünür
    await expect(card(page, 'TEK KİŞİ İKİNUMARA')).toContainText('0500 000 10 09');
    // Biri silinir, diğeri kalır
    await card(page, 'AHMET YAPAY').getByRole('button', { name: 'AHMET YAPAY kişisini sil' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(card(page, 'MEHMET DENEMEOĞLU').getByRole('button', { name: 'Otobüsümde' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('sum-total')).toHaveText('14');
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
  });
});

test.describe('PDF', () => {
  async function setupBus(page: Page, names: string[]) {
    await openFresh(page);
    await importFinal(page);
    await finishImport(page);
    for (const n of names) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await expect(page.getByTestId('sum-bus')).toHaveText(String(names.length));
    await nav(page, 'Otobüsüm');
    await page.getByTestId('open-pdf').click();
  }

  test('oluştur, otobüs bilgilerini sakla, indir: satır sayısı = yolcu sayısı, çoklu kişiler ayrı satır', async ({ page }) => {
    await setupBus(page, ['AHMET YAPAY', 'MEHMET DENEMEOĞLU', 'ÇAĞRI ÖĞÜTÇÜ']);
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Otobüs numarası').fill('7');
    await dlg.getByLabel('Plaka').fill('09 YAP 07');
    await dlg.getByLabel('Otobüs sorumlusu').fill('DENEME SORUMLU');
    await dlg.getByTestId('pdf-create').click();
    await expect(dlg.getByTestId('pdf-rows')).toHaveText('3');
    await expect(dlg.getByTestId('pdf-result')).toContainText(`GROWTECH_2026_Otobus_7_Yolcu_Listesi_${today()}.pdf`);

    // Otobüs bilgileri kalıcı
    await page.reload();
    await nav(page, 'Otobüsüm');
    await page.getByTestId('open-pdf').click();
    await expect(page.getByRole('dialog').getByLabel('Otobüs numarası')).toHaveValue('7');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByTestId('pdf-download').click()]);
    expect(download.suggestedFilename()).toBe(`GROWTECH_2026_Otobus_7_Yolcu_Listesi_${today()}.pdf`);
    const text = (await pdfText(readFileSync((await download.path())!))).join(' ');
    for (const n of ['AHMET YAPAY', 'MEHMET DENEMEOĞLU', 'ÇAĞRI ÖĞÜTÇÜ']) expect(text.split(n).length - 1).toBe(1);
    expect(text).not.toContain('AHMET YAPAY / MEHMET');
    expect(text).toContain('09 YAP 07');
    expect(text).toContain('DENEME SORUMLU');
    expect(text).not.toContain('İREM IŞIKLI'); // otobüste olmayan kişi PDF'e girmez
  });

  test('yoklama durumlu PDF seçili oturumdan', async ({ page }) => {
    await setupBus(page, ['AHMET YAPAY', 'MEHMET DENEMEOĞLU']);
    await page.getByRole('button', { name: 'Kapat' }).click();
    await nav(page, 'Yoklama');
    await page.getByRole('checkbox', { name: /AHMET YAPAY/ }).click();
    await nav(page, 'Otobüsüm');
    await page.getByTestId('open-pdf').click();
    const dlg = page.getByRole('dialog');
    await dlg.getByText('Yoklama Durumlu Yolcu Listesi').click();
    await dlg.getByLabel('Yoklama oturumu seçin').selectOption({ label: 'Gidiş' });
    const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByTestId('pdf-download').click()]);
    expect(download.suggestedFilename()).toMatch(/^GROWTECH_2026_Otobus_Yoklama_Gidis_\d{2}-\d{2}-\d{4}\.pdf$/);
    const text = (await pdfText(readFileSync((await download.path())!))).join(' ');
    expect(text).toContain('YOKLAMA DURUMU');
    expect((text.match(/(^|\s)Bindi(\s|$)/g) ?? []).length).toBe(1);
    expect((text.match(/(^|\s)Bekleniyor(\s|$)/g) ?? []).length).toBe(1);
  });

  test('paylaş: kişisel veri uyarısı, ardından gerçek PDF dosyası paylaşılır', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared?: unknown };
      Object.defineProperty(navigator, 'canShare', { value: (d: { files?: File[] }) => !!d.files?.length, configurable: true });
      Object.defineProperty(navigator, 'share', {
        value: async (d: { files: File[] }) => {
          w.__shared = { name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, count: d.files.length };
        },
        configurable: true,
      });
    });
    await setupBus(page, ['AHMET YAPAY']);
    const dlg = page.getByRole('dialog');
    await dlg.getByTestId('pdf-share').click();
    await expect(dlg.getByTestId('pdf-share-panel')).toContainText('kişisel veri');
    await dlg.getByTestId('pdf-share-confirm').click();
    const shared = await page.waitForFunction(() => (window as unknown as { __shared?: unknown }).__shared).then((h) => h.jsonValue());
    expect(shared).toMatchObject({ type: 'application/pdf', count: 1 });
    expect((shared as { name: string }).name).toMatch(/^GROWTECH_2026_.*\.pdf$/);
    expect((shared as { size: number }).size).toBeGreaterThan(5000);
  });

  test('dosya paylaşımı desteklenmiyorsa indirme seçeneği gösterilir', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await setupBus(page, ['AHMET YAPAY']);
    const dlg = page.getByRole('dialog');
    await dlg.getByTestId('pdf-share').click();
    await expect(dlg.getByTestId('pdf-share-unsupported')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByTestId('pdf-share-panel').getByRole('button', { name: 'PDF İndir' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});

test('çevrimdışı PDF oluşturma ve indirme', async ({ page, context }) => {
  await openFresh(page);
  await importFinal(page);
  await finishImport(page);
  await card(page, 'AHMET YAPAY').getByRole('button', { name: 'Otobüsüme ekle' }).click();
  await expect(page.getByTestId('sum-bus')).toHaveText('1');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await nav(page, 'Otobüsüm');
  await page.getByTestId('open-pdf').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByTestId('pdf-download').click()]);
  const text = (await pdfText(readFileSync((await download.path())!))).join(' ');
  expect(text).toContain('AHMET YAPAY');
  expect(text).toContain('OTOBÜS YOLCU LİSTESİ');
  await context.setOffline(false);
});
