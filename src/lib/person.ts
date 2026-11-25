import { VERIFY_FLAGS, type Person } from '../types';
import { formatPhone, telHref } from './phone';

/** Aranacak numara: önce kişisel (ana veya ek), yoksa ortak irtibat. */
export function callTarget(p: Person): { number: string; shared: boolean } | null {
  const own = [p.phone, ...(p.extraPhones ?? [])].find((x) => x && telHref(x));
  if (own) return { number: own, shared: false };
  const s = p.sharedPhones.find((x) => telHref(x));
  return s ? { number: s, shared: true } : null;
}

/** Kontrol edilmesi gereken kayıt mı? (doğrulanmamış eşleşme, eksik telefon vb.) */
export function needsCheck(p: Person) {
  return p.flags.some((f) => VERIFY_FLAGS.includes(f) || f === 'missing-phone');
}

/**
 * Raporlar (metin, Excel, PDF) için iletişim metni. Doğrulanmamış veya ortak
 * numaralar kesin bilgi gibi sunulmaz; numara yoksa "Belirtilmemiş" yazılır.
 */
export function contactText(p: Person): string {
  const own = [p.phone, ...(p.extraPhones ?? [])].filter(Boolean).map(formatPhone);
  if (own.length) return own.join(' / ') + (p.flags.includes('pairing-unverified') ? ' (doğrulanmadı)' : '');
  if (p.sharedPhones.length) return `Ortak irtibat: ${p.sharedPhones.map(formatPhone).join(' / ')} (kime ait olduğu doğrulanmadı)`;
  return 'Belirtilmemiş';
}
