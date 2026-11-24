import { cleanSpaces, digitsOnly } from './text';

export interface ParsedPhone {
  /** Normalleştirilmiş numara (ör. "05321234567") ya da doğrulanamayan ham değer. */
  value: string;
  /** Türkiye cep/sabit formatına uyuyor mu? */
  valid: boolean;
}

/**
 * Tek bir telefon parçasını normalleştirir. Sonuç her zaman string'dir.
 * 5321234567 → 05321234567, +90 532 123 45 67 → 05321234567.
 * Tanınmayan biçimler uydurma düzeltme yapılmadan ham haliyle döner.
 */
export function normalizePhone(raw: string): ParsedPhone | null {
  const text = cleanSpaces(raw);
  if (!text) return null;
  let d = digitsOnly(text);
  if (!d) return null;
  if (d.length === 12 && d.startsWith('90')) d = '0' + d.slice(2);
  if (d.length === 10 && /^[2-5]/.test(d)) d = '0' + d;
  if (d.length === 11 && /^0[2-5]/.test(d)) return { value: d, valid: true };
  return { value: text, valid: false };
}

/** Telefon hücresindeki ayırıcılar: /, //, ////, satır sonu, ;, |, virgül, " - ", " ve ". */
const PHONE_SPLIT = /\s*(?:\/+|\\+|\n+|;+|\|+|,+|\s-\s|\sve\s|\s+veya\s+)\s*/i;

/**
 * Bir telefon hücresini parçalara ayırır. Ayırıcısız yan yana yazılmış iki tam numara
 * (ör. "0532xxxxxxx 0542xxxxxxx") rakam uzunluğundan güvenle ayrılabiliyorsa ayrılır.
 */
export function splitPhones(cell: string): ParsedPhone[] {
  const text = cleanSpaces(cell);
  if (!text) return [];
  const out: ParsedPhone[] = [];
  for (const part of text.split(PHONE_SPLIT)) {
    if (!part || !digitsOnly(part)) continue;
    const d = digitsOnly(part);
    if (d.length === 22 && /^0[2-5]\d{9}0[2-5]\d{9}$/.test(d)) {
      out.push({ value: d.slice(0, 11), valid: true }, { value: d.slice(11), valid: true });
      continue;
    }
    if (d.length === 20 && /^[2-5]\d{9}[2-5]\d{9}$/.test(d)) {
      out.push({ value: '0' + d.slice(0, 10), valid: true }, { value: '0' + d.slice(10), valid: true });
      continue;
    }
    const p = normalizePhone(part);
    if (p) out.push(p);
  }
  // Aynı numara iki kez yazılmışsa tekilleştir.
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.value) ? false : (seen.add(p.value), true)));
}

/** Ekranda gösterim: 05321234567 → "0532 123 45 67". */
export function formatPhone(value: string): string {
  if (/^0\d{10}$/.test(value)) {
    return `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7, 9)} ${value.slice(9)}`;
  }
  return value;
}

/** tel: bağlantısı için güvenli numara. */
export function telHref(value: string): string {
  const d = digitsOnly(value);
  return d ? `tel:${d}` : '';
}
