import { expect, test, type Page } from '@playwright/test';
import { card, importSynthetic, nav, openFresh } from './helpers';

async function assertNoHorizontalScroll(page: Page) {
  const { scrollW, clientW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
  expect(scrollW, 'yatay kaydırma olmamalı').toBeLessThanOrEqual(clientW);
}

/** Görünür tüm düğme / bağlantı / form alanlarının dokunma alanı en az 44 px olmalı. */
async function assertTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=file]):not(.sr-only), [role=checkbox], [role=radio], summary'));
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.classList.contains('sr-only')) return false;
        if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) {
          // checkbox/radio'lar 44px'lik etiket alanının içinde
          const label = el.closest('label');
          return !label || label.getBoundingClientRect().height < 44;
        }
        return r.height < 44 || r.width < 44;
      })
      .map((el) => `${el.tagName} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
  });
  expect(small, 'küçük dokunma alanları').toEqual([]);
}

test('mobil yerleşim: yatay kaydırma yok, dokunma alanları ≥ 44px', async ({ page }) => {
  await openFresh(page);
  await assertNoHorizontalScroll(page);
  await importSynthetic(page);
  for (const n of ['ÇAĞRI ÖRNEKOĞLU', 'İSMAİL DENEME']) await card(page, n).getByRole('button', { name: 'Otobüsüme ekle' }).click();

  for (const tab of ['Katılımcılar', 'Otobüsüm', 'Yoklama', 'Ayarlar'] as const) {
    await nav(page, tab);
    await page.waitForTimeout(150);
    await assertNoHorizontalScroll(page);
    await assertTouchTargets(page);
  }
  // PDF ekranı
  await nav(page, 'Otobüsüm');
  await page.getByTestId('open-pdf').click();
  await assertNoHorizontalScroll(page);
  await assertTouchTargets(page);
  await page.getByRole('button', { name: 'Kapat' }).click();

  // Form ve içe aktarma ekranları
  await nav(page, 'Katılımcılar');
  await page.getByRole('button', { name: 'Yeni Katılımcı' }).click();
  await assertNoHorizontalScroll(page);
  await assertTouchTargets(page);
  await page.getByRole('button', { name: 'Vazgeç' }).click();

  // Alt navigasyon sabit ve görünür
  const navBox = await page.getByRole('navigation', { name: 'Ana menü' }).boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.round(navBox!.y + navBox!.height)).toBeGreaterThanOrEqual(vp.height - 1);
});
