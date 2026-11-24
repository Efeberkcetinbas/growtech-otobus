/**
 * TAMAMEN YAPAY test verisi. Gerçek kişi, firma veya telefon numarası içermez.
 * Telefonlar 0500 000 xx xx aralığındadır. Yapı gerçek Excel'in biçimini taklit eder:
 * başlık üstünde birleşik bir başlık satırı, değişken yazımlar, çoklu katılımcı hücreleri.
 */
export const SYNTHETIC_HEADER = [
  'Sıra No', 'Üye Sicil No', 'Unvan', 'Tescil Adresi', 'Cep Telefonu', 'Durumu',
  'Nace Faaliyet Kodu', 'Nace Faaliyet Adı', 'Oda Bölge Adı', 'PERSONEL', 'TALEPLER',
  'KATILACAK / KATILMAYACAK', 'KATILIMCI AD/SOYAD', 'KATILIMCI İRTİBAT NUMARASI',
  'OTOBÜS/KENDİ ARACI', 'BİNECEĞİ YER (otobüs ise)', 'ODA TİPİ', '2. KİŞİ GETİRME TALEBİ OLANLAR',
];

type R = { sicil: string; firma: string; cep: string | number; kat: string; ad: string; tel: string | number; ulasim: string; binis: string; ek?: string };

const rows: R[] = [
  { sicil: '9001', firma: 'DENEME TARIM LTD. ŞTİ.', cep: '05000000901', kat: 'KATILACAK', ad: 'ÇAĞRI ÖRNEKOĞLU', tel: '05000000001', ulasim: 'OTOBÜS', binis: 'MERKEZ DURAK' },
  { sicil: '9002', firma: 'ÖRNEK GIDA A.Ş.', cep: 5000000902, kat: 'KATILACAK ', ad: 'AYŞE TESTOĞLU ', tel: 5000000002, ulasim: 'OTOBÜS ', binis: 'KÖŞK ' },
  { sicil: '9003', firma: 'SAHTE ZİRAAT KOOP.', cep: '0500 000 09 03', kat: 'KATILACAK', ad: 'İSMAİL DENEME / ŞULE ÖRNEK', tel: '0500 000 00 03 / 05000000004', ulasim: 'OTOBÜS', binis: 'MERKEZ DURAK' },
  { sicil: '9004', firma: 'TEST TOHUM LTD.', cep: '05000000904', kat: 'KATILACAK', ad: 'GÜLŞEN YAPAY / ÖMER KURGU', tel: '05000000005', ulasim: 'OTOBÜS', binis: 'KÖŞK' },
  { sicil: '9005', firma: 'KURGU SÜT ÜRÜNLERİ', cep: '05000000905', kat: 'KATILACAK', ad: 'HÜSEYİN SANAL (BAŞKAN)', tel: '', ulasim: 'OTOBÜS', binis: '??' },
  { sicil: '9006', firma: 'YAPAY YAĞ SAN.', cep: '05000000906', kat: 'KATILACAK', ad: 'FATMA DEMO  //// ZEKİ DEMO', tel: '0500 000 00 06 ////  0500 000 00 07', ulasim: 'OTOBÜS  ', binis: 'BORSA ÖNÜ' },
  { sicil: '9007', firma: 'DEMO ZEYTİN', cep: '05000000907', kat: 'KATILACAK', ad: 'ÖZGÜR YAZIMHATASI', tel: '05000000008', ulasim: 'OTOBÜD', binis: 'MERKEZ DURAK' },
  { sicil: '9008', firma: 'ÖRNEK MAKİNE', cep: '05000000908', kat: 'KATILACAK / MECLİS ÜYESİ', ad: 'SELİN MİNİBÜSÇÜ', tel: '05000000009', ulasim: 'SPRİNTER', binis: '' },
  { sicil: '9009', firma: 'SANAL TİCARET', cep: '05000000909', kat: 'KATILACAK', ad: 'KEREM KENDİARAÇ', tel: '05000000010', ulasim: 'KENDİ ARACI', binis: '' },
  { sicil: '9010', firma: 'DENEME LOJİSTİK', cep: '05000000910', kat: 'KATILMAYACAK', ad: '', tel: '', ulasim: '', binis: '' },
  { sicil: '9011', firma: 'TEST İNŞAAT', cep: '05000000911', kat: 'ULAŞILAMADI / AÇMIYOR', ad: '', tel: '', ulasim: '', binis: '' },
  { sicil: '9012', firma: 'KURGU ENERJİ', cep: '05000000912', kat: 'KATILACAK', ad: 'NUR BELİRSİZ', tel: '05000000011', ulasim: 'BELLİ DEĞİL', binis: '' },
  { sicil: '9013', firma: 'YAPAY TEKSTİL', cep: '05000000913', kat: 'KATILMAYACAK ', ad: 'CEM ÇELİŞKİ', tel: '05000000012', ulasim: 'OTOBÜS', binis: 'KÖŞK' },
  { sicil: '', firma: 'SİCİLSİZ DENEME FİRMASI', cep: '', kat: 'KATILACAK', ad: 'DUYGU SİCİLSİZ', tel: '0500 000 00 13', ulasim: 'OTOBÜS', binis: 'BORSADAN ', ek: 'EK KATILIMCI GETİRMEK İSTİYOR / ÖDEDİ' },
  { sicil: '9015', firma: 'TEST HAYVANCILIK', cep: '05000000915', kat: 'KATILACAK', ad: 'ARDA KENDİ', tel: '05000000014', ulasim: 'KENDİ', binis: '' },
  { sicil: '9016', firma: 'DEMO TURİZM', cep: '05000000916', kat: 'KATILACAK', ad: 'EZGİ ÜÇLÜ / BARIŞ ÜÇLÜ / İREM ÜÇLÜ', tel: '05000000015 / 05000000016', ulasim: 'OTOBÜS', binis: 'MERKEZ DURAK' },
];

export function syntheticRows(): (string | number)[][] {
  const out: (string | number)[][] = [['GROWTECH FUARI ÜYE LİSTESİ (YAPAY TEST VERİSİ)'], SYNTHETIC_HEADER];
  rows.forEach((r, i) => {
    out.push([i + 1, r.sicil, r.firma, 'TEST ADRESİ', r.cep, 'Faal', '00.00', 'TEST', 'MERKEZ', 'TEST PERSONEL', '', r.kat, r.ad, r.tel, r.ulasim, r.binis, '-', r.ek ?? '']);
  });
  return out;
}

/** Beklenen değerler (yukarıdaki yapay satırlardan elle sayılmıştır). */
export const SYNTHETIC_EXPECTED = {
  totalRows: 16,
  attendingRows: 13,
  /** 9001, 9002, 9003, 9004, 9005, 9006, sicilsiz, 9016 */
  busRows: 8,
  /** 1 + 1 + 2 + 2 + 1 + 2 + 1 + 3 */
  busPeople: 13,
  multiPersonRows: 4,
};
