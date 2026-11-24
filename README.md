# GROWTECH 2026 – Otobüs Yolcu ve Yoklama Sistemi

**Aydın Ticaret Borsası** Growtech Fuarı organizasyonunda otobüs sorumluları için hazırlanmış, telefonda tek elle kullanılabilen bir web uygulaması (PWA).

🔗 **Canlı uygulama:** <https://efeberkcetinbas.github.io/growtech-otobus/>

## Ne işe yarar?

Hangi katılımcının hangi otobüse bineceği önceden belli değildir. Bu uygulama ile:

1. Üye listesi Excel dosyasını telefonunuza yüklersiniz (dosya **yalnızca cihazda** okunur).
2. Katılımcı geldiğinde adını arar, **“Otobüsüme ekle”** ile kendi listenize alırsınız.
3. Otobüsünüzdeki kişilerin isim ve telefonlarını görür, gerektiğinde tek dokunuşla ararsınız.
4. **Gidiş, Dönüş** ve dilediğiniz ek oturumlarda (ör. “Mola sonrası”) ayrı ayrı yoklama alırsınız.

Sunucu, veri tabanı, hesap veya ücretli servis yoktur. Tüm kayıtlar telefonunuzun tarayıcısında saklanır.

## Telefona ana ekran kısayolu ekleme

- **iPhone (Safari):** Uygulama adresini açın → alttaki **Paylaş** düğmesi → **Ana Ekrana Ekle**.
- **Android (Chrome):** Adresi açın → sağ üstteki **⋮** menü → **Ana ekrana ekle** / **Uygulamayı yükle**.

Ana ekrandan açılan uygulama tam ekran çalışır ve tarayıcının kayıtları silme ihtimali azalır.

## Excel yükleme

1. **Katılımcılar** ekranındaki **Excel yükle** düğmesine (veya **Ayarlar → Excel yükle**) dokunun ve `.xlsx` dosyasını seçin.
2. Uygulama başlık satırını **otomatik bulur**; sütunların sırası önemli değildir. Kullanılan sütunlar: *Üye Sicil No, Unvan, Katılacak/Katılmayacak, Katılımcı Ad/Soyad, Katılımcı İrtibat Numarası, Otobüs/Kendi Aracı, Bineceği Yer*.
3. Önizleme ekranında şunlar gösterilir: toplam satır, katılacak üye, otobüs kullanacak üye, ayrıştırılmış kişi, eksik telefon, doğrulama gereken kayıtlar, birden fazla katılımcılı kayıtlar ve dışarıda bırakılanlar.
4. Yalnızca **“Katılacak” + “Otobüs”** kayıtları varsayılan olarak alınır. Katılmayacak, ulaşılamayan ve kendi aracıyla gelecek kişiler alınmaz.
5. **OTOBÜD** gibi yazım hataları ve **SPRİNTER** gibi farklı ulaşım türleri otomatik alınmaz; ayrı listelenir, isterseniz işaretleyerek dahil edersiniz.
6. **Aynı hücrede birden fazla kişi** varsa (ör. `AHMET YILMAZ / MEHMET DEMİR`) her biri ayrı kişi olur.
   - İki isim + iki numara: sıralı eşleştirme **önerilir** ama “doğrulanmadı” olarak işaretlenir. Her kişinin numarasını seçip **Eşleştirme doğru** kutusunu işaretleyin.
   - İki isim + tek numara: numara kimseye atanmaz, **ortak irtibat** olarak gösterilir.
   - Eksik isim veya telefon için **hiçbir zaman sahte veri üretilmez**.
   - Firmanın üye kaydındaki telefon, katılımcının kişisel telefonu yerine kullanılmaz.
7. **Devam** → karşılaştırma ekranı → **İçe aktar**.

**Yeni Excel yüklemek** otobüs listenizi, yoklamalarınızı ve elle yaptığınız düzeltmeleri silmez. Aynı kişi tekrar oluşturulmaz. Hem sizin düzelttiğiniz hem de Excel’de değişen bilgiler için **“Benimki kalsın / Excel’i kullan”** seçimi sorulur. Yeni dosyada olmayan kişiler silinmez, “Son Excel’de yok” etiketi alır. Her yüklemeden önce mevcut verilerin otomatik kopyası alınır.

## Katılımcı arama

- Üstteki büyük arama kutusuna **isim, firma, telefon veya biniş yeri** yazın.
- Türkçe karakter gerekmez: `cagri` yazınca **ÇAĞRI** bulunur.
- Filtreler: **Tümü**, **Eklenmemiş** (otobüse henüz alınmayanlar), **Kontrol gerekli** ve **biniş yeri** seçimi.
- Listede olmayan kişi için **Yeni Katılımcı**: ad soyad zorunlu; telefon, firma, biniş yeri, açıklama isteğe bağlı. “Doğrudan otobüsüme ekle” varsayılan olarak açıktır. Benzer isim veya aynı telefon varsa uyarı verilir (ortak telefon kullanan farklı kişiler yine de eklenebilir).
- **Düzelt** ile bilgiler değiştirilebilir; değişiklik Otobüsüm ve Yoklama ekranlarına anında yansır.

## Otobüs listesi oluşturma

- Katılımcı kartındaki **Otobüsüme ekle** → düğme **Otobüsümde** olur; aynı kişi iki kez eklenemez.
- **Otobüsüm** ekranında: sıra no, ad soyad, telefon, firma, biniş yeri; **Ara**, **Düzelt**, **Çıkar** (yanlışlıkla çıkarırsanız “Geri al”).
- Arama ve sıralama (eklenme sırası, isim, biniş yeri).
- **Kopyala**, **Paylaş** (WhatsApp vb.), **Excel indir** (her yoklama oturumunun durumu dahil).
- **Tüm otobüs listesini temizle** onay ister; kişiler havuzdan ve yoklama geçmişi silinmez.

## Yoklama alma

- **Yoklama** ekranında yalnızca otobüsünüzdeki kişiler görünür.
- Kişinin adına veya büyük kutucuğa dokunun → kart yeşil olur, **Bindi** yazar, sayaçlar güncellenir ve **anında kaydedilir**.
- Üstte toplam / binen / beklenen yolcu ve ilerleme çubuğu; **Tümü / Binenler / Beklenenler** filtreleri. Beklenenler doğrudan aranabilir.
- **Gidiş** ve **Dönüş** ayrı yoklamalardır. **Yeni yoklama** ile ek oturum (Mola sonrası, Fuar çıkışı…) açabilirsiniz.
- **Tikleri temizle** yalnızca seçili oturumu sıfırlar (onay ister); yolcu listesi ve diğer oturumlar etkilenmez.

## Yedekleme

**Ayarlar → JSON yedeği indir**: tüm katılımcılar, düzeltmeler, otobüs listesi, tüm yoklama oturumları ve ayarlar tek bir `.json` dosyasına kaydedilir. Önemli anlarda (Excel yükledikten sonra, gidiş yoklamasından sonra) yedek almanız önerilir. Yedek dosyası kişisel veri içerir; güvenli saklayın, herkese açık yerlere yüklemeyin.

## Geri yükleme

**Ayarlar → Yedekten geri yükle** ile `.json` dosyasını seçin. Yedekteki kayıt sayıları gösterilir ve onay istenir. Geri yüklemeden önce mevcut verileriniz **otomatik olarak** hem cihazda bir kopyaya alınır hem de ayrıca dosya olarak indirilir. **Otomatik kopyalar** bölümünden son 5 kopyaya geri dönebilirsiniz.

## Çevrimdışı çalışma

İlk açılışta uygulama dosyaları telefona önbelleklenir (“Uygulama çevrimdışı kullanıma hazır” bildirimi). Sonrasında internet olmadan da arama, kişi ekleme/düzeltme, otobüs listesi ve yoklama çalışır; her şey cihazda kaydedilir. Yeni sürüm yayınlandığında “Güncelle” düğmesi çıkar; güncelleme kayıtlarınızı silmez.

## Yerel veri saklama sınırlamaları

- Veriler yalnızca **bu telefonun bu tarayıcısında** (IndexedDB) durur; başka cihazla otomatik eşitlenmez.
- Tarayıcı verilerini/geçmişini temizlemek, uygulamayı silmek veya gizli sekme kullanmak kayıtları **kaybettirebilir**. Bu yüzden düzenli JSON yedeği alın.
- Uygulama, destekleyen tarayıcılarda “kalıcı depolama” izni ister (Ayarlar ekranında durumu görünür).
- iPhone’da Safari ile açılan sayfa ve ana ekrana eklenen uygulama ayrı depolama kullanabilir; her zaman aynı yerden açın.

## Gizlilik

- Excel dosyası ve kişisel veriler **hiçbir sunucuya gönderilmez**; analitik/izleme servisi yoktur.
- Bu depoda gerçek isim, telefon veya Excel dosyası **yoktur**. Testler tamamen yapay verilerle çalışır (`tests/fixtures/synthetic.ts`).
- `.gitignore` tüm Excel/CSV dosyalarını ve yedekleri dışarıda bırakır.

## Geliştirme

Gereksinim: Node.js 24+.

```bash
npm install
npm run dev          # geliştirme sunucusu
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Vitest unit testleri
npm run build        # production build (dist/)
npx playwright install chromium webkit
npm run test:e2e     # Playwright (build edilmiş uygulama üzerinde)
```

Gerçek Excel ile **yalnızca yerelde** doğrulama (dosya proje klasörüne kopyalanmaz, çıktı yalnızca sayılardır):

```bash
GROWTECH_REAL_XLSX="/yol/liste.xlsx" npm run test:real
node scripts/leak-check.mjs "/yol/liste.xlsx"   # kişisel veri sızıntı taraması
```

Teknolojiler: React, TypeScript, Vite, Tailwind CSS, Lucide, SheetJS, Dexie.js (IndexedDB), vite-plugin-pwa (Workbox), Vitest, Playwright.

## Kod güncelleme ve otomatik yayın

`main` dalına yapılan her `git push` sonrası GitHub Actions sırasıyla lint, TypeScript, unit testler, production build ve Playwright testlerini çalıştırır; hepsi geçerse uygulama GitHub Pages’e otomatik yayınlanır (`.github/workflows/deploy.yml`). Testlerden biri başarısız olursa yayın yapılmaz ve canlı sürüm değişmez.

```bash
git add .
git commit -m "Açıklama"
git push
```

IndexedDB şeması değişecekse `src/lib/db.ts` içinde yeni bir `this.version(n)` eklenir; eski sürümler silinmez, böylece kullanıcıların kayıtları korunur.
