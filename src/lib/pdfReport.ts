/**
 * PDF'i oluşturulduğu anda IndexedDB'deki güncel otobüs listesinden üretir ve
 * indirme / paylaşma işlemlerini yönetir. Bu modül yalnızca gerektiğinde yüklenir.
 */
import boldUrl from '../assets/fonts/NotoSans-Bold.ttf?url';
import regularUrl from '../assets/fonts/NotoSans-Regular.ttf?url';
import { db } from './db';
import { buildPassengerPdf, toBase64, type BusInfo, type PdfFonts, type PdfOutput, type PdfPassenger, type ReportKind } from './pdf';
import { contactText } from './person';

let fontCache: Promise<PdfFonts> | null = null;

/** Yazı tipleri uygulama dosyalarıyla birlikte önbelleğe alınır; çevrimdışı da yüklenir. */
export function loadFonts(): Promise<PdfFonts> {
  if (!fontCache) {
    fontCache = Promise.all([regularUrl, boldUrl].map(async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error('Yazı tipi yüklenemedi.');
      return toBase64(await res.arrayBuffer());
    })).then(([regular, bold]) => ({ regular, bold }));
    fontCache.catch(() => (fontCache = null));
  }
  return fontCache;
}

export const EMPTY_BUS_INFO: BusInfo = { number: '', plate: '', supervisor: '' };

export async function getBusInfo(): Promise<BusInfo> {
  const row = await db.settings.get('busInfo');
  return { ...EMPTY_BUS_INFO, ...((row?.value as Partial<BusInfo>) ?? {}) };
}

export function saveBusInfo(info: BusInfo) {
  return db.settings.put({ key: 'busInfo', value: info });
}

/** Otobüs listesindeki kişiler (eklenme sırasıyla), oluşturma anındaki veritabanı durumuyla. */
export async function collectPassengers(sessionId?: string): Promise<PdfPassenger[]> {
  return db.transaction('r', db.bus, db.persons, db.checks, async () => {
    const bus = await db.bus.orderBy('addedAt').toArray();
    const persons = await db.persons.bulkGet(bus.map((b) => b.personId));
    const checked = sessionId ? new Set((await db.checks.where('sessionId').equals(sessionId).toArray()).map((c) => c.personId)) : new Set<string>();
    const out: PdfPassenger[] = [];
    for (const p of persons) {
      if (!p || p.deletedAt) continue;
      out.push({
        seq: out.length + 1,
        fullName: p.fullName,
        company: p.company,
        contact: contactText(p),
        boarding: p.boardingPlace,
        boarded: sessionId ? checked.has(p.id) : undefined,
      });
    }
    return out;
  });
}

export async function generateReport(kind: ReportKind, sessionId?: string): Promise<PdfOutput> {
  const [fonts, info, passengers, session] = await Promise.all([
    loadFonts(),
    getBusInfo(),
    collectPassengers(kind === 'attendance' ? sessionId : undefined),
    sessionId ? db.sessions.get(sessionId) : Promise.resolve(undefined),
  ]);
  if (!passengers.length) throw new Error('Otobüs listeniz boş.');
  return buildPassengerPdf({ kind, info, passengers, createdAt: new Date(), fonts, sessionName: kind === 'attendance' ? session?.name : undefined });
}

export function downloadPdf(out: PdfOutput) {
  const url = URL.createObjectURL(out.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = out.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function pdfFile(out: PdfOutput): File {
  return new File([out.bytes], out.fileName, { type: 'application/pdf' });
}

/** Tarayıcı PDF dosyası paylaşmayı destekliyor mu (Web Share API Level 2)? */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Gerçek PDF dosyasını cihazın paylaşım ekranıyla paylaşır (WhatsApp, e-posta…). */
export async function sharePdf(file: File): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [file], title: file.name, text: 'GROWTECH 2026 otobüs yolcu listesi' });
    return 'shared';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
    throw e;
  }
}
