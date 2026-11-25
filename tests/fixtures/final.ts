/**
 * Güncel Excel biçimini taklit eden TAMAMEN YAPAY test verisi (sarı işaretli satırlar dahil).
 * Gerçek kişi, firma, telefon veya TC kimlik numarası içermez.
 * Telefonlar 0500 000 xx xx; TC değerleri 9999999xxxx biçiminde sahte değerlerdir.
 */
export const FINAL_HEADER = [
  'Sıra No', 'Üye Sicil No', 'Unvan', 'Durumu', 'Oda Bölge Adı', 'PERSONEL',
  'KATILACAK / KATILMAYACAK', 'KATILIMCI AD/SOYAD', 'KATILIMCI İRTİBAT NUMARASI', 'TC NO',
  'OTOBÜS/KENDİ ARACI', 'BİNECEĞİ YER (otobüs ise)', 'ODA TİPİ', 'GELDİ/GELMEDİ',
];

/** Sahte TC değerleri: uygulamaya/veritabanına/PDF'e asla geçmemeli. */
export const FAKE_TC = ['99999990001', '99999990002', '99999990003', '99999990004'];

export const LONG_COMPANY =
  'ÇOK UZUN UNVANLI YAPAY ÖRNEK TARIM ÜRÜNLERİ GIDA İTHALAT İHRACAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ AYDIN ŞUBESİ';

interface R {
  sicil: string;
  firma: string;
  kat: string;
  ad: string;
  tel: string | number;
  tc: string;
  ulasim: string;
  binis: string;
  /** 'row': tüm satır sarı · 'cell': yalnızca biniş yeri hücresi sarı */
  yellow?: 'row' | 'cell';
}

export const FINAL_ROWS: R[] = [
  { sicil: '8001', firma: 'YAPAY TARIM A.Ş.', kat: 'KATILACAK', ad: 'AHMET YAPAY / MEHMET DENEMEOĞLU', tel: '05000001001 / 05000001002', tc: FAKE_TC[0], ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8002', firma: 'ÖRNEK GIDA', kat: 'KATILACAK ', ad: 'ÇAĞRI ÖĞÜTÇÜ', tel: 5000001003, tc: FAKE_TC[1], ulasim: 'OTOBÜS ', binis: 'KÖŞK / TÜRKMEN PETROL' },
  { sicil: '8003', firma: 'TEST KOOP.', kat: 'KATILACAK', ad: 'İREM IŞIKLI / ŞULE ÜNLÜ', tel: '05000001004', tc: FAKE_TC[2], ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8004', firma: 'DENEME LTD', kat: 'KATILACAK / MECLİS ÜYESİ', ad: 'SARI OTOBÜSÇÜ', tel: '05000001013', tc: FAKE_TC[3], ulasim: 'OTOBÜS', binis: 'BORSA', yellow: 'row' },
  { sicil: '8005', firma: 'KURGU A.Ş.', kat: 'KATILACAK', ad: 'KENDİ GELEN', tel: '05000001014', tc: '', ulasim: 'KENDİ', binis: '-' },
  { sicil: '8006', firma: 'SPRİNT TUR', kat: 'KATILACAK / MECLİS ÜYESİ', ad: 'SPRİNTER YOLCU', tel: '05000001015', tc: '', ulasim: 'SPRİNTER', binis: '-', yellow: 'row' },
  { sicil: '8007', firma: 'ŞOFÖR TAŞIMACILIK', kat: 'KATILACAK', ad: 'ŞOFÖR KİŞİ', tel: '05000001016', tc: '', ulasim: 'ŞOFÖR', binis: 'ŞOFÖR', yellow: 'cell' },
  { sicil: '8008', firma: 'ÜÇLÜ FİRMA', kat: 'KATILACAK', ad: 'BİR ÜÇLÜ //// İKİ ÜÇLÜ / ÜÇ ÜÇLÜ', tel: '05000001005 // 0500 000 10 06 / 05000001007', tc: '', ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8009', firma: 'ÇOK NUMARA LTD', kat: 'KATILACAK', ad: 'TEK KİŞİ İKİNUMARA', tel: '05000001008 / 05000001009', tc: '', ulasim: 'OTOBÜS', binis: 'UMURLU / HAL ÖNÜ' },
  { sicil: '8010', firma: 'EKSİK TEL A.Ş.', kat: 'KATILACAK', ad: 'TELEFONU YOK', tel: '-', tc: '', ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8011', firma: 'BELİRSİZ AD LTD', kat: 'KATILACAK', ad: 'ADEM / KAYA', tel: '05000001010', tc: '', ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8012', firma: 'KATILMAZ A.Ş.', kat: 'KATILMAYACAK', ad: 'GELMEYEN KİŞİ', tel: '05000001017', tc: '', ulasim: 'OTOBÜS', binis: 'BORSA' },
  { sicil: '8013', firma: 'BOŞ ULAŞIM', kat: 'KATILACAK', ad: 'ULAŞIMI BOŞ', tel: '05000001018', tc: '', ulasim: '', binis: '' },
  { sicil: '8014', firma: 'SARI KENDİ LTD', kat: 'KATILACAK', ad: 'SARI KENDİCİ', tel: '05000001019', tc: '', ulasim: 'KENDİ', binis: '-', yellow: 'row' },
  { sicil: '8015', firma: 'SATIR SONU A.Ş.', kat: 'KATILACAK', ad: 'SATIR BİRİNCİ\nSATIR İKİNCİ', tel: '05000001011\n05000001012', tc: '', ulasim: 'OTOBÜS', binis: 'KUYUCAK / DÖRTYOL' },
  { sicil: '8016', firma: LONG_COMPANY, kat: 'KATILACAK', ad: 'UZUN FİRMALI KİŞİ', tel: '05000001020', tc: '', ulasim: 'OTOBÜS', binis: 'NAZİLLİ / REFERANS HASTANESİ ÖNÜ' },
];

/** Beklenen değerler (yukarıdaki yapay satırlardan elle sayılmıştır; kodda sabit değildir). */
export const FINAL_EXPECTED = {
  totalRows: 16,
  yellowRows: 4, // 8004, 8006, 8007 (yalnızca bir hücre), 8014
  busRowsAll: 11, // 8001 8002 8003 8004 8008 8009 8010 8011 8012 8015 8016
  busRowsYellow: 1, // 8004
  busRows: 9, // katılacak + otobüs + sarı değil
  people: 15, // 2+1+2+3+1+1+2+2+1
  multiPersonRows: 5, // 8001 8003 8008 8011 8015
  verificationRows: 5,
  missingPhone: 1, // 8010
};

export function finalRows(): (string | number)[][] {
  const out: (string | number)[][] = [['GROWTECH FUARI KATILACAKLAR LİSTESİ (YAPAY TEST VERİSİ)'], FINAL_HEADER];
  FINAL_ROWS.forEach((r, i) => out.push([i + 1, r.sicil, r.firma, 'Faal', 'MERKEZ', 'TEST', r.kat, r.ad, r.tel, r.tc, r.ulasim, r.binis, 'SNG', '']));
  return out;
}

/** `finalRows()` dizisinde sarı satırların indeksleri. */
export function finalYellowIndexes(): Set<number> {
  return new Set(FINAL_ROWS.flatMap((r, i) => (r.yellow ? [i + 2] : [])));
}

/**
 * Hücre dolgularıyla gerçek bir .xlsx üretir (ExcelJS). Başlık satırı da bilerek sarı
 * yapılır: başlık biçimlendirmesi veri satırlarıyla karıştırılmamalı.
 */
export async function buildFinalXlsx(): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('reportUyeListesi');
  const yellow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFF00' } };
  const rows = finalRows();
  rows.forEach((r) => ws.addRow(r));
  ws.mergeCells(1, 1, 1, FINAL_HEADER.length);
  ws.getRow(2).eachCell((c) => (c.fill = yellow));
  FINAL_ROWS.forEach((r, i) => {
    const excelRow = ws.getRow(i + 3);
    if (r.yellow === 'row') for (let c = 1; c <= FINAL_HEADER.length; c++) excelRow.getCell(c).fill = yellow;
    if (r.yellow === 'cell') excelRow.getCell(12).fill = yellow;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
