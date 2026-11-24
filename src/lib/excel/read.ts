import type { Cell, ParseResult } from './parse';
import { ExcelFormatError, parseRows } from './parse';

/** Excel dosyasını tamamen cihaz üzerinde okur ve ayrıştırır (SheetJS). */
export async function readExcel(buffer: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true, dense: true });
  const preferred = ['reportUyeListesi', ...wb.SheetNames];
  let lastError: unknown = null;
  for (const name of [...new Set(preferred)]) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: '', blankrows: false });
    try {
      return parseRows(rows, name);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new ExcelFormatError('Excel dosyasında okunabilir sayfa bulunamadı.');
}
