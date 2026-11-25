import type { Flag } from '../../types';
import { splitPhones } from '../phone';
import { cleanSpaces, foldTr, levenshtein } from '../text';

export type Cell = string | number | boolean | Date | null | undefined;

export type ColumnKey =
  | 'sicil'
  | 'company'
  | 'companyPhone'
  | 'attendance'
  | 'name'
  | 'phone'
  | 'transport'
  | 'boarding'
  | 'extra';

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  sicil: 'Üye Sicil No',
  company: 'Unvan',
  companyPhone: 'Cep Telefonu (firma)',
  attendance: 'Katılacak / Katılmayacak',
  name: 'Katılımcı Ad/Soyad',
  phone: 'Katılımcı İrtibat Numarası',
  transport: 'Otobüs / Kendi Aracı',
  boarding: 'Bineceği Yer',
  extra: '2. Kişi Getirme Talebi',
};

const REQUIRED: ColumnKey[] = ['attendance', 'name', 'transport'];

/** Başlık metnini (sadeleştirilmiş) bir sütun anahtarıyla eşleştirir. Sıra önemlidir. */
function matchHeader(folded: string): ColumnKey | null {
  const f = ` ${folded} `;
  // TC kimlik numarası sütunu hiçbir alana eşlenmez; değerleri okunmaz.
  if (/ tc( |$)/.test(f) || f.includes('kimlik')) return null;
  if (f.includes(' sicil')) return 'sicil';
  if (f.includes('binecegi') || f.includes('binis')) return 'boarding';
  if (f.includes('irtibat') || (f.includes('katilimci') && (f.includes(' tel') || f.includes('numara')))) return 'phone';
  if (f.includes('katilimci ad') || f.includes(' ad soyad') || f.includes(' adi soyadi') || f.includes(' isim')) return 'name';
  if (f.includes('katilacak') || f.includes('katilim durum')) return 'attendance';
  if (f.includes('kendi arac') || f.includes('ulasim') || f.trim().startsWith('otobus')) return 'transport';
  if (f.includes('2 kisi') || f.includes('ek katilimci')) return 'extra';
  if (f.includes('cep tel') || f.trim() === 'telefon') return 'companyPhone';
  if (f.trim() === 'unvan' || f.includes('unvan') || f.includes('firma')) return 'company';
  return null;
}

export interface HeaderInfo {
  headerIndex: number;
  columns: Partial<Record<ColumnKey, number>>;
  missingRequired: ColumnKey[];
  missingOptional: ColumnKey[];
}

/** İlk 30 satırda en çok bilinen başlığı içeren satırı başlık olarak bulur. */
export function detectHeader(rows: Cell[][]): HeaderInfo | null {
  let best: HeaderInfo | null = null;
  let bestScore = 0;
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const columns: Partial<Record<ColumnKey, number>> = {};
    (rows[i] ?? []).forEach((cell, c) => {
      const text = cleanSpaces(cell);
      if (!text) return;
      const key = matchHeader(foldTr(text));
      if (key && columns[key] === undefined) columns[key] = c;
    });
    const score = Object.keys(columns).length;
    if (score > bestScore) {
      bestScore = score;
      const all = Object.keys(COLUMN_LABELS) as ColumnKey[];
      best = {
        headerIndex: i,
        columns,
        missingRequired: REQUIRED.filter((k) => columns[k] === undefined),
        missingOptional: all.filter((k) => !REQUIRED.includes(k) && columns[k] === undefined),
      };
    }
  }
  return best && bestScore >= 3 ? best : null;
}

export type Attendance = 'attending' | 'not-attending' | 'unreachable' | 'unknown';
export type Transport = 'bus' | 'bus-typo' | 'own-car' | 'other' | 'unknown';

export function classifyAttendance(raw: string): Attendance {
  const f = foldTr(raw);
  if (!f) return 'unknown';
  if (f.startsWith('katilmayacak') || f.startsWith('katilmiyor') || f.startsWith('gelmeyecek') || f === 'hayir') return 'not-attending';
  if (f.startsWith('ulasilamadi') || f.includes('acmiyor') || f.includes('ulasilamiyor')) return 'unreachable';
  if (f.startsWith('katilacak') || f.startsWith('katiliyor') || f.startsWith('gelecek') || f === 'evet') return 'attending';
  return 'unknown';
}

const UNKNOWN_TRANSPORT = new Set(['', 'belli degil', 'belirsiz', 'donecek', 'yok', 'bilinmiyor']);

export function classifyTransport(raw: string): Transport {
  const f = foldTr(raw);
  const compact = f.replace(/\s+/g, '');
  if (UNKNOWN_TRANSPORT.has(f) || !compact) return 'unknown';
  const mentionsBus = compact.includes('otobus');
  const mentionsCar = f.startsWith('kendi') || f.includes('arac') || f.includes('ozel');
  if (mentionsBus && mentionsCar) return 'unknown';
  if (compact === 'otobus' || compact.startsWith('otobus')) return 'bus';
  if (mentionsCar) return 'own-car';
  if (compact.startsWith('otob') || levenshtein(compact, 'otobus') <= 2) return 'bus-typo';
  return 'other';
}

const UNKNOWN_BOARDING = /^[\s?\-.–_]*$/;

export function cleanBoarding(raw: string): { value: string; unknown: boolean } {
  const v = cleanSpaces(raw).replace(/\n/g, ' ');
  if (!v || UNKNOWN_BOARDING.test(v) || ['yok', 'belli degil', 'bilinmiyor'].includes(foldTr(v))) {
    return { value: '', unknown: true };
  }
  return { value: v, unknown: false };
}

/** İsim hücresi ayırıcıları: /, ////, \, satır sonu, ;, |, &, +, " - ", " ve ". */
const NAME_SPLIT = /\s*(?:\/+|\\+|\n+|;+|\|+|&|\+|\s-\s|\s+ve\s+)\s*/i;

export interface NamePart {
  fullName: string;
  /** Parantez içi ek bilgi: BAŞKAN, YÖN. KUR. ÜYESİ, OĞLU vb. */
  role: string;
}

export function splitNames(cell: string): { parts: NamePart[]; ambiguous: boolean } {
  const text = cleanSpaces(cell);
  if (!text) return { parts: [], ambiguous: false };
  let ambiguous = /\s-\s/.test(text);
  const parts: NamePart[] = [];
  for (const seg of text.split(NAME_SPLIT)) {
    const roles: string[] = [];
    const name = seg
      .replace(/\(([^)]*)\)?/g, (_m, inner: string) => {
        const r = cleanSpaces(inner);
        if (r) roles.push(r);
        return ' ';
      })
      .replace(/[,.:;]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!name || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(name)) continue;
    parts.push({ fullName: name, role: roles.join(', ') });
  }
  // "AHMET / YILMAZ" gibi tek kelimelik parça: ad ve soyad yanlışlıkla bölünmüş olabilir.
  if (parts.length > 1 && parts.some((p) => !p.fullName.includes(' '))) ambiguous = true;
  return { parts, ambiguous: ambiguous && parts.length > 1 };
}

export interface ParsedPerson {
  sourceKey: string;
  fullName: string;
  role: string;
  phone: string;
  /** Tek kişiye yazılmış ek numaralar (kişinin kendi numaraları). */
  extraPhones: string[];
  sharedPhones: string[];
  flags: Flag[];
  /** Kullanıcının önizlemede seçebileceği, satırdaki tüm numaralar. */
  phoneOptions: string[];
}

/**
 * included: Katılacak + OTOBÜS + sarı değil (varsayılan olarak alınır)
 * typo: OTOBÜD gibi yazım hatası (yalnızca kullanıcı onaylarsa alınır)
 * excluded: diğer her şey (sarı, KENDİ, SPRİNTER, ŞOFÖR, belirsiz, katılmayacak…)
 */
export type RowCategory = 'included' | 'typo' | 'excluded';

export interface ParsedRow {
  rowNumber: number;
  sicilNo: string;
  company: string;
  companyKey: string;
  companyPhone: string;
  attendanceRaw: string;
  transportRaw: string;
  boarding: string;
  extraNote: string;
  attendance: Attendance;
  transport: Transport;
  /** Satırdaki herhangi bir veri hücresi sarı (#FFFF00) dolgulu mu? */
  yellow: boolean;
  category: RowCategory;
  excludeReason: string;
  people: ParsedPerson[];
  /** İsim–telefon eşleştirmesi kullanıcı tarafından doğrulanmalı mı? */
  needsVerification: boolean;
}

export interface ParseResult {
  sheetName: string;
  header: HeaderInfo;
  totalRows: number;
  rows: ParsedRow[];
  /** Hücre dolgu renkleri okundu mu? Okunamadıysa içe aktarma yapılmaz. */
  stylesRead: boolean;
}

export interface ParseOptions {
  /** Sarı dolgulu satırların `rows` dizisindeki indeksleri. */
  yellowRows?: Set<number>;
  stylesRead?: boolean;
  /** `rows[0]` sayfanın kaçıncı satırı (0 tabanlı). */
  rowOffset?: number;
}

export class ExcelFormatError extends Error {}

export const REASONS = {
  yellow: 'Sarı işaretli satır',
  notAttending: 'Katılmayacak',
  unreachable: 'Ulaşılamadı',
  attendanceUnknown: 'Katılım durumu belirtilmemiş',
  ownCar: 'Kendi aracıyla gelecek (KENDİ / KENDİ ARACI)',
  otherTransport: 'Otobüs dışı ulaşım (SPRİNTER, ŞOFÖR vb.)',
  unknownTransport: 'Ulaşım türü belirsiz',
  noName: 'Katılımcı adı yazılmamış',
  duplicate: 'Mükerrer satır (aynı firma ve isim daha önce var)',
} as const;

/** Excel satırlarını katılımcı kayıtlarına ayrıştırır. Veri uydurmaz. */
export function parseRows(rows: Cell[][], sheetName = 'Sayfa', opts: ParseOptions = {}): ParseResult {
  const yellowRows = opts.yellowRows ?? new Set<number>();
  const rowOffset = opts.rowOffset ?? 0;
  const header = detectHeader(rows);
  if (!header) throw new ExcelFormatError('Başlık satırı bulunamadı. Katılımcı Ad/Soyad, Katılacak ve Otobüs sütunları gerekli.');
  if (header.missingRequired.length) {
    throw new ExcelFormatError(
      'Gerekli sütun(lar) bulunamadı: ' + header.missingRequired.map((k) => COLUMN_LABELS[k]).join(', '),
    );
  }
  const col = header.columns;
  const get = (row: Cell[], key: ColumnKey) => (col[key] === undefined ? '' : cleanSpaces(cellToText(row[col[key]!])));
  const seenKeys = new Set<string>();
  const parsed: ParsedRow[] = [];
  let totalRows = 0;

  for (let i = header.headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (!row.some((c) => cleanSpaces(cellToText(c)) !== '')) continue;
    totalRows++;
    const sicilNo = get(row, 'sicil');
    const company = get(row, 'company').replace(/\n/g, ' ');
    const companyKey = sicilNo ? `s:${sicilNo}` : company ? `u:${foldTr(company)}` : `r:${i + 1}`;
    const attendanceRaw = get(row, 'attendance');
    const transportRaw = get(row, 'transport');
    const attendance = classifyAttendance(attendanceRaw);
    const transport = classifyTransport(transportRaw);
    const boardingInfo = cleanBoarding(get(row, 'boarding'));
    const extraNote = get(row, 'extra');
    const yellow = yellowRows.has(i);

    // Sıra önemli: sarı işaret her şeyden önce gelir (OTOBÜS olsa bile alınmaz).
    let category: RowCategory = 'excluded';
    let excludeReason: string = '';
    if (yellow) excludeReason = REASONS.yellow;
    else if (attendance === 'not-attending') excludeReason = REASONS.notAttending;
    else if (attendance === 'unreachable') excludeReason = REASONS.unreachable;
    else if (attendance === 'unknown') excludeReason = REASONS.attendanceUnknown;
    else if (transport === 'own-car') excludeReason = REASONS.ownCar;
    else if (transport === 'other') excludeReason = REASONS.otherTransport;
    else if (transport === 'unknown') excludeReason = REASONS.unknownTransport;
    else if (transport === 'bus') category = 'included';
    else category = 'typo';

    const { parts, ambiguous } = splitNames(get(row, 'name'));
    const phones = splitPhones(get(row, 'phone'));
    if (category !== 'excluded' && parts.length === 0) {
      category = 'excluded';
      excludeReason = REASONS.noName;
    }

    const people = pairPeople(parts, phones, ambiguous);
    const uniquePeople: ParsedPerson[] = [];
    for (const p of people) {
      if (boardingInfo.unknown) p.flags.push('boarding-unknown');
      if (category === 'typo') p.flags.push('transport-typo');
      p.sourceKey = `${companyKey}|${foldTr(p.fullName)}`;
      if (category !== 'excluded') {
        // Aynı firma + aynı isim tekrar yazılmışsa mükerrer kişi oluşturma.
        if (seenKeys.has(p.sourceKey)) continue;
        seenKeys.add(p.sourceKey);
      }
      uniquePeople.push(p);
    }
    if (category !== 'excluded' && uniquePeople.length === 0) {
      category = 'excluded';
      excludeReason = REASONS.duplicate;
    }

    parsed.push({
      rowNumber: rowOffset + i + 1,
      sicilNo,
      company,
      companyKey,
      companyPhone: splitPhones(get(row, 'companyPhone')).map((p) => p.value).join(' / '),
      attendanceRaw,
      transportRaw,
      boarding: boardingInfo.value,
      extraNote,
      attendance,
      transport,
      yellow,
      category,
      excludeReason,
      people: category === 'excluded' ? people : uniquePeople,
      needsVerification: (category === 'excluded' ? people : uniquePeople).some((p) =>
        p.flags.some((f) => f === 'pairing-unverified' || f === 'shared-phone' || f === 'ambiguous-separator' || f === 'invalid-phone'),
      ),
    });
  }
  return { sheetName, header, totalRows, rows: parsed, stylesRead: opts.stylesRead ?? false };
}

function cellToText(c: Cell): string {
  if (c === null || c === undefined) return '';
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(c);
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c);
}

/**
 * İsimlerle numaraları eşleştirir.
 * - 1 isim / 1 numara: doğrudan atanır.
 * - 1 isim / birden fazla numara: hepsi o kişinindir (ilk numara + ek numaralar).
 * - N isim / N numara (N>1): sıralı eşleştirme ÖNERİLİR, doğrulanmamış işaretlenir.
 * - N isim / 1 numara: numara kimseye atanmaz, ortak irtibat olarak gösterilir.
 * - Sayılar farklıysa: hiçbir numara tahminle atanmaz, hepsi ortak irtibat olur.
 * - Numara yoksa: telefon boş kalır.
 */
export function pairPeople(
  parts: NamePart[],
  phones: { value: string; valid: boolean }[],
  ambiguousSeparator = false,
): ParsedPerson[] {
  const values = phones.map((p) => p.value);
  const invalid = new Set(phones.filter((p) => !p.valid).map((p) => p.value));
  return parts.map((part, idx) => {
    const flags: Flag[] = [];
    let phone = '';
    let extraPhones: string[] = [];
    let sharedPhones: string[] = [];
    if (parts.length === 1) {
      phone = values[0] ?? '';
      if (values.length > 1) {
        flags.push('extra-phone');
        extraPhones = values.slice(1);
      }
    } else if (values.length === parts.length) {
      phone = values[idx];
      flags.push('pairing-unverified');
    } else if (values.length > 0) {
      sharedPhones = [...values];
      flags.push('shared-phone');
    }
    if (!phone && sharedPhones.length === 0) flags.push('missing-phone');
    if ([phone, ...extraPhones, ...sharedPhones].some((s) => s && invalid.has(s))) flags.push('invalid-phone');
    if (ambiguousSeparator) flags.push('ambiguous-separator');
    return { sourceKey: '', fullName: part.fullName, role: part.role, phone, extraPhones, sharedPhones, flags, phoneOptions: values };
  });
}

/** Kullanıcının dahil etme seçimine göre özet istatistik. */
export interface ImportStats {
  totalRows: number;
  /** Sarı dolgulu satır sayısı. */
  yellowRows: number;
  attendingRows: number;
  /** Ulaşımı OTOBÜS olan tüm satırlar (sarılar dahil). */
  busRowsAll: number;
  /** Sarı olduğu için dışarıda kalan OTOBÜS satırları. */
  busRowsYellow: number;
  /** Katılacak + OTOBÜS + sarı değil (ayrıştırma öncesi satır sayısı). */
  busRows: number;
  selectedRows: number;
  parsedPeople: number;
  missingPhone: number;
  sharedPhonePeople: number;
  verificationRows: number;
  multiPersonRows: number;
  excludedRows: number;
  excludedByReason: Record<string, number>;
}

export function isSelectable(row: ParsedRow) {
  return row.category !== 'excluded';
}

/**
 * @param peopleOf Önizlemedeki doğrulama kararları (ör. "tek kişi olarak birleştir")
 *   uygulanmış kişi listesi; verilmezse ayrıştırılmış kişiler kullanılır.
 */
export function computeStats(result: ParseResult, selected: Set<number>, peopleOf: (row: ParsedRow) => ParsedPerson[] = (r) => r.people): ImportStats {
  const stats: ImportStats = {
    totalRows: result.totalRows,
    yellowRows: 0,
    attendingRows: 0,
    busRowsAll: 0,
    busRowsYellow: 0,
    busRows: 0,
    selectedRows: 0,
    parsedPeople: 0,
    missingPhone: 0,
    sharedPhonePeople: 0,
    verificationRows: 0,
    multiPersonRows: 0,
    excludedRows: 0,
    excludedByReason: {},
  };
  for (const row of result.rows) {
    if (row.yellow) stats.yellowRows++;
    if (row.attendance === 'attending') stats.attendingRows++;
    if (row.transport === 'bus') stats.busRowsAll++;
    if (row.transport === 'bus' && row.yellow) stats.busRowsYellow++;
    if (row.category === 'included') stats.busRows++;
    if (selected.has(row.rowNumber) && isSelectable(row)) {
      const people = peopleOf(row);
      stats.selectedRows++;
      stats.parsedPeople += people.length;
      if (people.length > 1) stats.multiPersonRows++;
      if (row.needsVerification) stats.verificationRows++;
      for (const p of people) {
        if (!p.phone && !p.extraPhones.length && p.sharedPhones.length === 0) stats.missingPhone++;
        if (!p.phone && p.sharedPhones.length > 0) stats.sharedPhonePeople++;
      }
    } else {
      stats.excludedRows++;
      const reason = row.category === 'excluded' ? row.excludeReason : CATEGORY_REASON[row.category];
      stats.excludedByReason[reason] = (stats.excludedByReason[reason] ?? 0) + 1;
    }
  }
  return stats;
}

export const CATEGORY_REASON: Record<Exclude<RowCategory, 'excluded'>, string> = {
  included: 'Kullanıcı tarafından çıkarıldı',
  typo: 'Ulaşım yazım hatası şüphesi (onay bekliyor)',
};

/** Varsayılan seçim: yalnızca "Katılacak + Otobüs" satırları. */
export function defaultSelection(result: ParseResult): Set<number> {
  return new Set(result.rows.filter((r) => r.category === 'included').map((r) => r.rowNumber));
}
