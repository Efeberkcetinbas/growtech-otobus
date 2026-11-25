// package-lock.json tutarlılık kontrolü: her bağımlılık kilit dosyasında çözülebiliyor mu?
// (Windows'ta üretilen kilitte Linux'a özgü isteğe bağlı paketler düşerse GitHub Actions'taki
//  `npm ci` başarısız olur; bu betik bunu push etmeden önce yakalar.)
import { readFileSync } from 'node:fs';

const pk = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
const resolve = (from, name) => {
  let base = from;
  for (;;) {
    if (pk[`${base ? base + '/' : ''}node_modules/${name}`]) return true;
    if (!base) return false;
    const i = base.lastIndexOf('/node_modules/');
    base = i < 0 ? '' : base.slice(0, i);
  }
};
const missing = [];
for (const [path, entry] of Object.entries(pk)) {
  for (const field of ['dependencies', 'optionalDependencies']) {
    for (const name of Object.keys(entry[field] ?? {})) if (!resolve(path, name)) missing.push(`${path || '(kök)'} → ${name}`);
  }
}
if (missing.length) {
  console.error(`package-lock.json eksik kayıt içeriyor (${missing.length}):\n${missing.join('\n')}\nÇözüm: node_modules ve package-lock.json silip npm install çalıştırın.`);
  process.exit(1);
}
console.log(`PASS: package-lock.json tutarlı (${Object.keys(pk).length} kayıt).`);
