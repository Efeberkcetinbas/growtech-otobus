import type { Person } from '../types';
import { digitsOnly, foldTr } from './text';

/** Kişi için önceden hesaplanmış arama metni (ad, firma, biniş yeri, telefonlar). */
export function searchIndex(p: Person): { text: string; digits: string[] } {
  return {
    text: foldTr([p.fullName, p.company, p.boardingPlace].join(' ')),
    digits: [p.phone, ...(p.extraPhones ?? []), ...p.sharedPhones].map(digitsOnly).filter(Boolean),
  };
}

/** Türkçe karakter toleranslı arama: "cagri" → "ÇAĞRI", "0532 12" → "05321..." */
export function matches(index: { text: string; digits: string[] }, query: string): boolean {
  const q = foldTr(query);
  if (!q) return true;
  const qDigits = digitsOnly(query);
  if (qDigits.length >= 3 && qDigits.length === q.replace(/\s/g, '').length) {
    const qd = qDigits.replace(/^0+/, '');
    return index.digits.some((d) => d.replace(/^0+/, '').includes(qd));
  }
  return q.split(' ').every((token) => index.text.includes(token));
}

export function filterPersons<T extends Person>(persons: T[], query: string): T[] {
  if (!foldTr(query)) return persons;
  return persons.filter((p) => matches(searchIndex(p), query));
}
