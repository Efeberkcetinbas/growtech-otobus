import type { BusEntry } from '../hooks/useAppData';
import type { AttendanceCheck, AttendanceSession } from '../types';
import { formatPhone } from './phone';

export function listToText(entries: BusEntry[], title = 'GROWTECH 2026 – Otobüs listem'): string {
  const lines = entries.map(({ person: p }, i) => {
    const phone = p.phone ? formatPhone(p.phone) : p.sharedPhones.length ? `Ortak: ${p.sharedPhones.map(formatPhone).join(' / ')}` : 'Tel yok';
    return [`${i + 1}. ${p.fullName}`, phone, p.company, p.boardingPlace].filter(Boolean).join(' – ');
  });
  return `${title} (${entries.length} kişi)\n\n${lines.join('\n')}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Eski tarayıcılar için yedek yöntem
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Otobüs listesini (ve her oturumun yoklama durumunu) .xlsx olarak cihaza indirir. */
export async function downloadBusExcel(entries: BusEntry[], sessions: AttendanceSession[], checks: AttendanceCheck[]) {
  const XLSX = await import('xlsx');
  const checked = new Set(checks.map((c) => `${c.sessionId}|${c.personId}`));
  const header = ['Sıra', 'Ad Soyad', 'Telefon', 'Ortak irtibat', 'Firma', 'Biniş Yeri', 'Açıklama', ...sessions.map((s) => `Yoklama: ${s.name}`)];
  const rows = entries.map(({ person: p }, i) => [
    i + 1,
    p.fullName,
    p.phone ? formatPhone(p.phone) : '',
    p.sharedPhones.map(formatPhone).join(' / '),
    p.company,
    p.boardingPlace,
    p.note,
    ...sessions.map((s) => (checked.has(`${s.id}|${p.id}`) ? 'Bindi' : '')),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Telefon sütunları metin olarak kalsın
  ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 30 }, ...sessions.map(() => ({ wch: 14 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Otobüs Listem');
  XLSX.writeFile(wb, `growtech-otobus-listem-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
