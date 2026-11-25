/**
 * Otobüs yolcu listesi PDF'i (A4 yatay, seçilebilir metin, gömülü Türkçe yazı tipi).
 * Tamamen cihaz üzerinde jsPDF + jsPDF-AutoTable ile üretilir; ekran görüntüsü değildir.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData } from 'jspdf-autotable';

export interface BusInfo {
  number: string;
  plate: string;
  supervisor: string;
}

export type ReportKind = 'standard' | 'attendance';

export interface PdfPassenger {
  seq: number;
  fullName: string;
  company: string;
  contact: string;
  boarding: string;
  /** Yalnızca yoklama durumlu raporda. */
  boarded?: boolean;
}

export interface PdfFonts {
  /** Base64 TTF */
  regular: string;
  bold: string;
}

export interface PdfInput {
  kind: ReportKind;
  info: BusInfo;
  passengers: PdfPassenger[];
  createdAt: Date;
  fonts: PdfFonts;
  /** Yoklama durumlu raporda seçili oturum. */
  sessionName?: string;
}

export interface PdfOutput {
  blob: Blob;
  bytes: ArrayBuffer;
  fileName: string;
  pageCount: number;
  rowCount: number;
}

const GREEN: [number, number, number] = [0x12, 0x3b, 0x32];
const GREEN_LIGHT: [number, number, number] = [0x27, 0x88, 0x5c];
const GRAY_BG: [number, number, number] = [0xf1, 0xf3, 0xf2];
const GRAY_ROW: [number, number, number] = [0xf7, 0xf8, 0xf7];
const INK: [number, number, number] = [0x17, 0x25, 0x1f];
const MUTED: [number, number, number] = [0x5b, 0x67, 0x62];
const AMBER: [number, number, number] = [0x8a, 0x5a, 0x12];
const FONT = 'NotoSans';
const M = 12; // kenar boşluğu (mm)

export function formatDateTime(d: Date) {
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Dosya adı için ASCII: GROWTECH_2026_Otobus_1_Yolcu_Listesi_26-11-2026.pdf */
export function pdfFileName(kind: ReportKind, busNumber: string, date: Date, sessionName?: string) {
  const ascii = (s: string) =>
    s
      .replace(/[çÇ]/g, (c) => (c === 'ç' ? 'c' : 'C'))
      .replace(/[ğĞ]/g, (c) => (c === 'ğ' ? 'g' : 'G'))
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/[öÖ]/g, (c) => (c === 'ö' ? 'o' : 'O'))
      .replace(/[şŞ]/g, (c) => (c === 'ş' ? 's' : 'S'))
      .replace(/[üÜ]/g, (c) => (c === 'ü' ? 'u' : 'U'))
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const bus = ascii(busNumber) ? `Otobus_${ascii(busNumber)}` : 'Otobus';
  const kindPart = kind === 'attendance' ? `Yoklama_${ascii(sessionName ?? '') || 'Durumu'}` : 'Yolcu_Listesi';
  return `GROWTECH_2026_${bus}_${kindPart}_${dd}-${mm}-${date.getFullYear()}.pdf`;
}

export function buildPassengerPdf(input: PdfInput): PdfOutput {
  const { kind, info, passengers, createdAt, fonts } = input;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
  doc.addFont('NotoSans-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
  doc.addFont('NotoSans-Bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');
  doc.setProperties({
    title: kind === 'attendance' ? 'GROWTECH 2026 – Yoklama Durumlu Yolcu Listesi' : 'GROWTECH 2026 – Otobüs Yolcu Listesi',
    subject: 'Aydın Ticaret Borsası – Growtech 2026 Fuar Organizasyonu',
    creator: 'Growtech Otobüs Yolcu ve Yoklama Sistemi',
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const boarded = passengers.filter((p) => p.boarded).length;
  const title = kind === 'attendance' ? 'OTOBÜS YOLCU LİSTESİ – YOKLAMA DURUMU' : 'OTOBÜS YOLCU LİSTESİ';

  // ---- Başlık bandı (ilk sayfa)
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFillColor(...GREEN_LIGHT);
  doc.rect(0, 30, W, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.text('AYDIN TİCARET BORSASI', M, 10.5);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  doc.text('GROWTECH 2026 FUAR ORGANİZASYONU', M, 16.5);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(15);
  doc.text(title, M, 25);

  // ---- Bilgi kutusu
  const fields: [string, string][] = [
    ['Otobüs numarası', info.number || '—'],
    ['Otobüs plakası', info.plate || '—'],
    ['Otobüs sorumlusu', info.supervisor || '—'],
    ['Oluşturulma', formatDateTime(createdAt)],
    ['Toplam yolcu', String(passengers.length)],
  ];
  if (kind === 'attendance') {
    fields.push(['Yoklama oturumu', input.sessionName || '—'], ['Binen yolcu', String(boarded)], ['Beklenen yolcu', String(passengers.length - boarded)]);
  }
  const perRow = 5;
  const boxRows = Math.ceil(fields.length / perRow);
  const boxY = 35;
  const boxH = 6 + boxRows * 11;
  doc.setFillColor(...GRAY_BG);
  doc.roundedRect(M, boxY, W - 2 * M, boxH, 2, 2, 'F');
  const colW = (W - 2 * M - 8) / perRow;
  fields.forEach(([label, value], i) => {
    const x = M + 4 + (i % perRow) * colW;
    const y = boxY + 7 + Math.floor(i / perRow) * 11;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toLocaleUpperCase('tr-TR'), x, y);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(value, colW - 4)[0] ?? '', x, y + 5.5);
  });

  // ---- Tablo
  const head = ['Sıra No', 'Ad Soyad', 'Firma Unvanı', 'İrtibat Numarası', 'Biniş Yeri'];
  if (kind === 'attendance') head.push('Durum');
  const body = passengers.map((p) => {
    const row = [String(p.seq), p.fullName, p.company || '—', p.contact, p.boarding || 'Belirtilmemiş'];
    if (kind === 'attendance') row.push(p.boarded ? 'Bindi' : 'Bekleniyor');
    return row;
  });
  const tableW = W - 2 * M;
  const columnStyles: Record<number, { cellWidth: number | 'auto'; halign?: 'center' | 'left' }> =
    kind === 'attendance'
      ? { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 52 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 56 }, 4: { cellWidth: 44 }, 5: { cellWidth: 24, halign: 'center' } }
      : { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 56 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 60 }, 4: { cellWidth: 50 } };

  autoTable(doc, {
    head: [head],
    body,
    startY: boxY + boxH + 5,
    margin: { left: M, right: M, top: 20, bottom: 16 },
    tableWidth: tableW,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: FONT,
      fontStyle: 'normal',
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0xdd, 0xe2, 0xe0],
      lineWidth: 0.2,
    },
    headStyles: { font: FONT, fontStyle: 'bold', fillColor: GREEN, textColor: [255, 255, 255], fontSize: 9.5 },
    alternateRowStyles: { fillColor: GRAY_ROW },
    columnStyles,
    didParseCell(data: CellHookData) {
      if (data.section !== 'body') return;
      const text = String(data.cell.raw ?? '');
      if (data.column.index === 1) data.cell.styles.fontStyle = 'bold';
      if (data.column.index === 3 && (text.includes('doğrulanmadı') || text === 'Belirtilmemiş')) data.cell.styles.textColor = AMBER;
      if (kind === 'attendance' && data.column.index === 5) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = text === 'Bindi' ? GREEN_LIGHT : AMBER;
      }
    },
  });

  // ---- Her sayfada üst/alt bilgi ve sayfa numarası
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(...GREEN);
      doc.rect(0, 0, W, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(9.5);
      doc.text(`AYDIN TİCARET BORSASI · GROWTECH 2026 · ${title}`, M, 7.8);
      doc.setFont(FONT, 'normal');
      doc.text(info.number ? `Otobüs ${info.number}` : '', W - M, 7.8, { align: 'right' });
    }
    doc.setDrawColor(0xdd, 0xe2, 0xe0);
    doc.setLineWidth(0.2);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Kişisel veri içerir – yalnızca organizasyon amacıyla kullanınız. Oluşturulma: ${formatDateTime(createdAt)}`, M, H - 6.5);
    doc.text(`Sayfa ${i} / ${pageCount}`, W - M, H - 6.5, { align: 'right' });
  }

  const bytes = doc.output('arraybuffer');
  return {
    bytes,
    blob: new Blob([bytes], { type: 'application/pdf' }),
    fileName: pdfFileName(kind, info.number, createdAt, input.sessionName),
    pageCount,
    rowCount: body.length,
  };
}

/** ArrayBuffer → base64 (büyük dosyalarda yığın taşmasını önlemek için parça parça). */
export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
