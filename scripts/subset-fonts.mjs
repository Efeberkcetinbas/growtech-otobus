// Noto Sans (SIL OFL 1.1) yazı tipini PDF için Latin + Türkçe karakterlere indirger.
// Kullanım: node scripts/subset-fonts.mjs
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';

const ranges = [
  [0x20, 0x7e], // Temel Latin
  [0xa0, 0xff], // Latin-1 (Ç Ö Ü ç ö ü …)
  [0x100, 0x17f], // Latin Genişletilmiş-A (Ğ ğ İ ı Ş ş …)
  [0x2010, 0x2027], // tireler, tırnaklar, madde imi, üç nokta
  [0x20ac, 0x20ac], // €
  [0x20ba, 0x20ba], // ₺
];
let text = '';
for (const [a, b] of ranges) for (let c = a; c <= b; c++) text += String.fromCodePoint(c);

const src = 'node_modules/@expo-google-fonts/noto-sans';
for (const [inFile, outFile] of [
  ['400Regular/NotoSans_400Regular.ttf', 'NotoSans-Regular.ttf'],
  ['700Bold/NotoSans_700Bold.ttf', 'NotoSans-Bold.ttf'],
]) {
  const out = await subsetFont(readFileSync(`${src}/${inFile}`), text, { targetFormat: 'truetype' });
  writeFileSync(`src/assets/fonts/${outFile}`, out);
  console.log(outFile, out.length, 'bayt');
}
copyFileSync(`${src}/LICENSE_FONT`, 'src/assets/fonts/OFL.txt');
