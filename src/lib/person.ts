import { VERIFY_FLAGS, type Person } from '../types';
import { telHref } from './phone';

/** Aranacak numara: önce kişisel, yoksa ortak irtibat. */
export function callTarget(p: Person): { number: string; shared: boolean } | null {
  if (p.phone && telHref(p.phone)) return { number: p.phone, shared: false };
  const s = p.sharedPhones.find((x) => telHref(x));
  return s ? { number: s, shared: true } : null;
}

/** Kontrol edilmesi gereken kayıt mı? (doğrulanmamış eşleşme, eksik telefon vb.) */
export function needsCheck(p: Person) {
  return p.flags.some((f) => VERIFY_FLAGS.includes(f) || f === 'missing-phone');
}
