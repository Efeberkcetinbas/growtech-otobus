import type { Cell, ParseResult } from './parse';
import { detectHeader, ExcelFormatError, parseRows } from './parse';

/** Bir hücre stilinin sarı (#FFFF00) arka plan dolgusu olup olmadığı. */
interface CellStyle {
  patternType?: string;
  fgColor?: { rgb?: string; indexed?: number };
  bgColor?: { rgb?: string; indexed?: number };
}

const YELLOW_RGB = /^(FF)?FFFF00$/i;
/** Varsayılan Excel paletinde indeks 13 = FFFF00 (sarı). */
const YELLOW_INDEXED = 13;

export function isYellowFill(s: CellStyle | undefined): boolean {
  if (!s || !s.patternType || s.patternType === 'none') return false;
  const c = s.fgColor;
  if (!c) return false;
  return (typeof c.rgb === 'string' && YELLOW_RGB.test(c.rgb)) || c.indexed === YELLOW_INDEXED;
}

/**
 * Excel dosyasını tamamen cihaz üzerinde okur: hücre değerleri + hücre dolgu renkleri.
 * Renkler okunamazsa içe aktarma yapılmaz (sarı satırlar ayıklanamayacağı için).
 */
export async function readExcel(buffer: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true, cellStyles: true });
  const stylesRead = !!(wb as { Styles?: { Fills?: unknown[] } }).Styles?.Fills;
  const preferred = ['reportUyeListesi', ...wb.SheetNames];
  let lastError: unknown = null;
  for (const name of [...new Set(preferred)]) {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    // blankrows: true → dizi indeksi = sayfa satırı - range.s.r (renk eşlemesi kaymaz)
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: '', blankrows: true });
    const header = detectHeader(rows);
    if (!header) {
      lastError = new ExcelFormatError('Başlık satırı bulunamadı.');
      continue;
    }
    if (!stylesRead) {
      throw new ExcelFormatError(
        'Hücre renkleri okunamadı; sarı işaretli satırlar ayıklanamaz. Dosyayı Excel’de “.xlsx” olarak kaydedip tekrar deneyin.',
      );
    }
    // Yalnızca başlıktan sonraki veri satırlarının dolgusu kontrol edilir.
    const yellowRows = new Set<number>();
    for (let i = header.headerIndex + 1; i < rows.length; i++) {
      const r = range.s.r + i;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as { s?: CellStyle } | undefined;
        if (cell && isYellowFill(cell.s)) {
          yellowRows.add(i);
          break;
        }
      }
    }
    try {
      return parseRows(rows, name, { yellowRows, stylesRead, rowOffset: range.s.r });
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new ExcelFormatError('Excel dosyasında okunabilir sayfa bulunamadı.');
}
