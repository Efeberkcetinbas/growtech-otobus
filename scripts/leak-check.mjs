// Kişisel veri sızıntı kontrolü (yalnızca yerelde çalıştırılır).
//
// Gerçek Excel'deki tüm isimleri, firma unvanlarını ve telefon numaralarını BELLEKTE okur,
// ardından git'e eklenecek dosyalarda, build çıktısında (dist) ve git geçmişinde arar.
// Hiçbir gerçek değeri ekrana yazmaz; yalnızca dosya adı ve eşleşme türünü raporlar.
//
// Kullanım:
//   node scripts/leak-check.mjs "C:\Users\...\Downloads\liste.xlsx"
//   (veya GROWTECH_REAL_XLSX ortam değişkeni)
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';

const file = process.argv[2] || process.env.GROWTECH_REAL_XLSX;
if (!file || !existsSync(file)) {
  console.error('Excel yolu verilmedi veya bulunamadı.');
  process.exit(2);
}

const fold = (s) =>
  String(s)
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıIİi]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.find((n) => n === 'reportUyeListesi') ?? wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
const headerIdx = rows.findIndex((r) => r.some((c) => /sicil/i.test(String(c))));
const header = rows[headerIdx].map((h) => fold(h));
const col = (pred) => header.findIndex(pred);
const nameCol = col((h) => h.includes('katilimci ad'));
const companyCol = col((h) => h === 'unvan');
const addressCol = col((h) => h.includes('adres'));

// İsim sütununa bazen yazılan genel ifadeler (kişi adı değildir): "BELLİ DEĞİL", "YÖN. KUR. ÜYESİ" vb.
const GENERIC = new Set(['belli', 'degil', 'yon', 'kur', 'uyesi', 'uye', 'meclis', 'birlik', 'tems', 'baskan', 'oglu', 'kizi', 'esi', 'yok', 'telefon', 'ad', 'soyad', 'bilinmiyor', 'katilacak', 'katilmayacak']);
const phones = new Set();
const names = new Set();
const companies = new Set();
for (const r of rows.slice(headerIdx + 1)) {
  for (const cell of r) {
    for (const m of String(cell).matchAll(/\d[\d\s]{8,16}\d/g)) {
      const d = m[0].replace(/\D/g, '');
      if (d.length >= 10 && d.length <= 12) phones.add(d.slice(-10));
    }
  }
  if (nameCol >= 0) {
    for (const part of String(r[nameCol]).split(/\/+|\n|\s-\s|\(|\)/)) {
      const f = fold(part);
      if (f.length >= 7 && f.includes(' ') && !f.split(' ').every((w) => GENERIC.has(w))) names.add(f);
    }
  }
  for (const c of [companyCol, addressCol]) {
    if (c >= 0) {
      const f = fold(r[c]);
      if (f.length >= 12) companies.add(f);
    }
  }
}
console.log(`Referans: ${phones.size} telefon, ${names.size} isim, ${companies.size} unvan/adres (değerler gösterilmez)`);

// Taranacak içerik: git'e eklenecek dosyalar + dist + git geçmişi
const targets = [];
const tracked = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
for (const f of tracked) targets.push({ label: f, path: f });
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else targets.push({ label: p, path: p });
  }
}
walk('dist');

const problems = [];
function scan(label, text) {
  const folded = ` ${fold(text)} `;
  for (const m of text.matchAll(/(?<!\d)(?:\+?90)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)|(?<!\d)\d{10,11}(?!\d)/g)) {
    if (phones.has(m[0].replace(/\D/g, '').slice(-10))) problems.push(`${label}: telefon numarası`);
  }
  for (const n of names) if (folded.includes(` ${n} `)) problems.push(`${label}: katılımcı adı`);
  for (const c of companies) if (folded.includes(` ${c} `)) problems.push(`${label}: firma unvanı/adres`);
}

const binary = /\.(png|jpg|jpeg|gif|ico|woff2?|zip)$/i;
for (const t of targets) {
  if (binary.test(t.path)) continue;
  if (/\.(xlsx|xls|xlsm|csv)$/i.test(t.path)) {
    problems.push(`${t.label}: tablo dosyası takipte`);
    continue;
  }
  scan(t.label, readFileSync(t.path, 'utf8'));
}

let historyScanned = false;
try {
  const log = execSync('git log --all -p --no-color', { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  scan('git geçmişi', log);
  historyScanned = true;
} catch {
  /* henüz commit yok */
}

console.log(`Taranan dosya: ${targets.length}${historyScanned ? ' + git geçmişi' : ' (git geçmişi henüz yok)'}`);
if (problems.length) {
  console.error(`SIZINTI ŞÜPHESİ (${problems.length}):\n` + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('PASS: Gerçek kişisel veri bulunamadı.');
