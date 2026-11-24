/** Türkçe metin yardımcıları. */

/** Fazla boşlukları (NBSP, sekme dahil) tek boşluğa indirger ve kırpar. */
export function cleanSpaces(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\t]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .trim();
}

/** Türkçe kurallarına göre büyük harfe çevirir (i → İ, ı → I). */
export function upperTr(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

const FOLD_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', i: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/**
 * Arama ve karşılaştırma için Türkçe karakterleri sadeleştirir:
 * "Çağrı ÖZTÜRK" → "cagri ozturk". Harf/rakam dışındakiler boşluğa çevrilir.
 */
export function foldTr(value: string): string {
  let out = '';
  for (const ch of value) out += FOLD_MAP[ch] ?? ch;
  return out
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sadece rakamlar. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** İki dizge arasındaki Levenshtein uzaklığı. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Türkçe alfabetik sıralama karşılaştırıcısı. */
export const compareTr = (a: string, b: string) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' });
