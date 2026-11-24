import { expect, test } from '@playwright/test';
import { card, importSynthetic, nav, openFresh, syntheticXlsx, trackExternalRequests } from './helpers';

test.describe('Excel içe aktarma', () => {
  test('önizleme sayıları, doğrulama ve onay', async ({ page }) => {
    const external = trackExternalRequests(page);
    await openFresh(page);
    await page.getByRole('button', { name: 'Excel yükle' }).first().click();
    await page.getByTestId('excel-input').setInputFiles(syntheticXlsx());
    await expect(page.getByTestId('stat-total')).toHaveText('16');
    await expect(page.getByTestId('stat-attending')).toHaveText('13');
    await expect(page.getByTestId('stat-bus')).toHaveText('8');
    await expect(page.getByTestId('stat-people')).toHaveText('13');
    await expect(page.getByTestId('stat-excluded')).toHaveText('8');
    // Çoklu kişi satırları doğrulama listesinde
    await expect(page.getByTestId('verify-row')).toHaveCount(4);
    // OTOBÜD otomatik dahil değil; onaylanınca kişi sayısı artar
    await page.getByLabel(/Otobüs olarak kabul et/).check();
    await expect(page.getByTestId('stat-people')).toHaveText('14');
    // İlk doğrulama satırında eşleşmeyi onayla
    await page.getByTestId('verify-row').first().getByLabel('Eşleştirme doğru').check();
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByTestId('plan-new')).toHaveText('14');
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('sum-total')).toHaveText('14');
    await expect(card(page, 'ÖZGÜR YAZIMHATASI')).toBeVisible();
    await expect(card(page, 'SELİN MİNİBÜSÇÜ')).toHaveCount(0); // SPRİNTER seçilmedi
    expect(external).toEqual([]);
  });
});

test.describe('katılımcılar ve otobüs', () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
    await importSynthetic(page);
  });

  test('Türkçe karakter toleranslı arama', async ({ page }) => {
    const search = page.getByLabel('Katılımcı ara');
    await search.fill('cagri');
    await expect(page.getByTestId('participant-card')).toHaveCount(1);
    await expect(card(page, 'ÇAĞRI ÖRNEKOĞLU')).toBeVisible();
    await search.fill('sule ornek');
    await expect(card(page, 'ŞULE ÖRNEK')).toBeVisible();
    await search.fill('0500 000 00 02');
    await expect(card(page, 'AYŞE TESTOĞLU')).toBeVisible();
    await search.fill('köşk');
    await expect(page.getByTestId('participant-card')).toHaveCount(3);
    await search.fill('ziraat');
    await expect(page.getByTestId('participant-card')).toHaveCount(2);
  });

  test('otobüse ekleme, mükerrer engeli, çıkarma ve geri alma', async ({ page }) => {
    const c = card(page, 'ÇAĞRI ÖRNEKOĞLU');
    await c.getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await expect(c.getByRole('button', { name: 'Otobüsümde' })).toBeVisible();
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await c.getByRole('button', { name: 'Otobüsümde' }).click({ force: true }); // aria-disabled: ikinci kez eklenemez
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    // telefonla ara tel: bağlantısı
    await expect(c.getByRole('link', { name: /ara/ })).toHaveAttribute('href', 'tel:05000000001');

    await nav(page, 'Otobüsüm');
    await expect(page.getByTestId('bus-total')).toHaveText('1');
    await page.getByRole('button', { name: 'ÇAĞRI ÖRNEKOĞLU listeden çıkar' }).click();
    await expect(page.getByText('Otobüs listeniz boş')).toBeVisible();
    await page.getByRole('button', { name: 'Geri al' }).click();
    await expect(page.getByTestId('bus-row')).toHaveCount(1);
    await expect(page.getByTestId('sum-total')).toHaveText('13');
  });

  test('filtreler: eklenmemiş ve biniş yeri', async ({ page }) => {
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await page.getByRole('button', { name: /Eklenmemiş/ }).click();
    await expect(page.getByTestId('participant-card')).toHaveCount(12);
    await page.getByRole('button', { name: /^Tümü/ }).click();
    await page.getByLabel('Biniş yerine göre filtrele').selectOption('KÖŞK');
    await expect(page.getByTestId('participant-card')).toHaveCount(3);
  });

  test('yeni katılımcı: mükerrer uyarısı ve doğrudan otobüse ekleme', async ({ page }) => {
    await page.getByRole('button', { name: 'Yeni Katılımcı' }).click();
    await page.getByRole('dialog').getByLabel('Ad soyad').fill('Cagri Ornekoglu');
    await page.getByRole('dialog').getByLabel('Telefon numarası').fill('0500 000 00 99');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByText('Benzer kayıt bulundu')).toBeVisible();
    await page.getByRole('button', { name: 'Geri dön' }).click();
    await page.getByRole('dialog').getByLabel('Ad soyad').fill('YENİ YOLCU DENEME');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.getByTestId('sum-total')).toHaveText('14');
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(card(page, 'YENİ YOLCU DENEME').getByRole('button', { name: 'Otobüsümde' })).toBeVisible();
  });

  test('düzenleme tüm ekranlara yansır', async ({ page }) => {
    await expect(card(page, 'NUR BELİRSİZ')).toHaveCount(0); // ulaşımı belirsiz, seçilmedi
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: /bilgilerini düzelt/ }).click();
    await page.getByRole('dialog').getByLabel('Ad soyad').fill('AYŞE TESTOĞLU YILDIZ');
    await page.getByRole('dialog').getByLabel('Biniş yeri').fill('YENİ DURAK');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(card(page, 'AYŞE TESTOĞLU YILDIZ')).toContainText('YENİ DURAK');
    await nav(page, 'Otobüsüm');
    await expect(page.getByTestId('bus-row').first()).toContainText('AYŞE TESTOĞLU YILDIZ');
    await nav(page, 'Yoklama');
    await expect(page.getByTestId('att-row').first()).toContainText('AYŞE TESTOĞLU YILDIZ');
    await expect(page.getByTestId('sum-total')).toHaveText('13');
  });

  test('listeyi temizleme onay ister, katılımcıları silmez', async ({ page }) => {
    for (const n of ['ÇAĞRI ÖRNEKOĞLU', 'AYŞE TESTOĞLU']) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Otobüsüm');
    await page.getByRole('button', { name: 'Tüm otobüs listesini temizle' }).click();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByTestId('bus-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Tüm otobüs listesini temizle' }).click();
    await page.getByRole('button', { name: 'Listeyi temizle' }).click();
    await expect(page.getByText('Otobüs listeniz boş')).toBeVisible();
    await expect(page.getByTestId('sum-total')).toHaveText('13');
  });
});

test.describe('yoklama', () => {
  test('işaretleme, bağımsız oturumlar, sıfırlama, yeni oturum ve kalıcılık', async ({ page }) => {
    await openFresh(page);
    await importSynthetic(page);
    for (const n of ['ÇAĞRI ÖRNEKOĞLU', 'AYŞE TESTOĞLU', 'DUYGU SİCİLSİZ']) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Yoklama');
    await expect(page.getByRole('radio', { name: 'Gidiş' })).toHaveAttribute('aria-checked', 'true');
    // İsme dokununca işaretlenir
    await page.getByRole('checkbox', { name: /ÇAĞRI ÖRNEKOĞLU/ }).click();
    await page.getByRole('checkbox', { name: /AYŞE TESTOĞLU/ }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('2');
    await expect(page.getByTestId('att-waiting')).toHaveText('1');
    await expect(page.getByTestId('sum-boarded')).toHaveText('2');
    await expect(page.getByTestId('att-row').filter({ hasText: 'ÇAĞRI' })).toHaveAttribute('data-checked', 'true');
    await expect(page.getByTestId('att-row').filter({ hasText: 'ÇAĞRI' })).toContainText('Bindi');
    // Filtreler
    await page.getByRole('button', { name: /^Beklenenler/ }).click();
    await expect(page.getByTestId('att-row')).toHaveCount(1);
    await expect(page.getByTestId('att-row').getByRole('link', { name: /ara/ })).toHaveAttribute('href', 'tel:05000000013');
    await page.getByRole('button', { name: /^Binenler/ }).click();
    await expect(page.getByTestId('att-row')).toHaveCount(2);
    await page.getByRole('button', { name: /^Tümü/ }).click();

    // Dönüş bağımsız
    await page.getByRole('radio', { name: 'Dönüş' }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('0');
    await page.getByRole('checkbox', { name: /DUYGU SİCİLSİZ/ }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('1');

    // Yeni oturum
    await page.getByRole('button', { name: 'Yeni yoklama' }).click();
    await page.getByRole('dialog').getByLabel('Oturum adı').fill('Mola sonrası');
    await page.getByRole('button', { name: 'Oluştur' }).click();
    await expect(page.getByRole('radio', { name: 'Mola sonrası' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('att-boarded')).toHaveText('0');

    // Sayfa yenileme sonrası kalıcılık
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Mola sonrası' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Gidiş' }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('2');

    // Gidiş sıfırlama yalnızca Gidiş'i etkiler (onaylı)
    await page.getByRole('button', { name: /tiklerini temizle/ }).click();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('2');
    await page.getByRole('button', { name: /tiklerini temizle/ }).click();
    await page.getByRole('button', { name: 'Tikleri temizle' }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('0');
    await expect(page.getByTestId('att-row')).toHaveCount(3);
    await page.getByRole('radio', { name: 'Dönüş' }).click();
    await expect(page.getByTestId('att-boarded')).toHaveText('1');
  });
});

test.describe('yeniden yükleme ve yedekleme', () => {
  test('Excel yeniden yükleme otobüsü, yoklamayı ve düzeltmeleri korur', async ({ page }) => {
    await openFresh(page);
    await importSynthetic(page);
    const c = card(page, 'ÇAĞRI ÖRNEKOĞLU');
    await c.getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await c.getByRole('button', { name: /bilgilerini düzelt/ }).click();
    await page.getByRole('dialog').getByLabel('Açıklama').fill('Ön koltuk');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await nav(page, 'Yoklama');
    await page.getByRole('checkbox', { name: /ÇAĞRI/ }).click();

    await nav(page, 'Ayarlar');
    await page.getByRole('button', { name: 'Excel yükle' }).click();
    await page.getByTestId('excel-input').setInputFiles(syntheticXlsx());
    await page.getByRole('button', { name: 'Devam' }).click();
    await expect(page.getByTestId('plan-new')).toHaveText('0');
    await expect(page.getByTestId('plan-unchanged')).toHaveText('13');
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('sum-total')).toHaveText('13');
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(page.getByTestId('sum-boarded')).toHaveText('1');
    await expect(card(page, 'ÇAĞRI ÖRNEKOĞLU')).toContainText('Ön koltuk');
  });

  test('JSON yedek indirme ve geri yükleme (öncesinde otomatik kopya)', async ({ page }) => {
    await openFresh(page);
    await importSynthetic(page);
    await card(page, 'AYŞE TESTOĞLU').getByRole('button', { name: 'Otobüsüme ekle' }).click();
    await nav(page, 'Ayarlar');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON yedeği indir' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^growtech-yedek-.*\.json$/);
    const backupPath = await download.path();

    // Veriyi değiştir
    await nav(page, 'Otobüsüm');
    await page.getByRole('button', { name: 'Tüm otobüs listesini temizle' }).click();
    await page.getByRole('button', { name: 'Listeyi temizle' }).click();
    await expect(page.getByTestId('sum-bus')).toHaveText('0');

    await nav(page, 'Ayarlar');
    await page.getByTestId('restore-input').setInputFiles(backupPath);
    await expect(page.getByText(/13 katılımcı, 1 otobüs yolcusu/)).toBeVisible();
    const [safety] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Geri yükle', exact: true }).click()]);
    expect(safety.suggestedFilename()).toMatch(/geri-yukleme-oncesi/);
    await expect(page.getByTestId('sum-bus')).toHaveText('1');
    await expect(page.getByText('Geri yükleme öncesi otomatik kopya')).toBeVisible();
  });

  test('geçersiz yedek dosyası reddedilir', async ({ page }) => {
    await openFresh(page);
    await nav(page, 'Ayarlar');
    await page.getByTestId('restore-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
    await expect(page.getByRole('alert')).toContainText('yedeği değil');
  });
});
