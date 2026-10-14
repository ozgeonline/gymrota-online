# GymRota Online

Kullanıcıya özel antrenman planlayıcı ve günlük takip uygulaması. Siyaha yakın zemin, buz mavisi başlıklar ve telefona uyarlanan arayüz.

## Kullanım

Yönetici tarafından açılan e-posta ve şifreyle giriş yapılır. İlk girişte boş program oluşturucu karşılar; hazır program atanmaz. Başlangıç tarihi, 1–12 hafta ve çalışma günleri seçilir. Her güne bölge önerilerinden hareket, özel hareket veya bütün bir video antrenmanı eklenebilir. Set/tekrar ya da süre; isteğe bağlı ağırlık, dinlenme ve HTTPS video bağlantısı tanımlanır.

Haftalık düzen belirtilen süre boyunca tekrarlanır. Tikler ve notlar tarihe özeldir. Bir günün tüm çalışmaları işaretlenince gün tamamlanır. Notlar “Notu kaydet” ile kaydedilir. Bir hesap birden fazla program oluşturabilir ve düzenleyebilir. Takibi başlayan programın tarihleri sabittir; farklı tarihler için yeni program oluşturulur.

Öneri listesindeki çalışma miktarları düzenlenebilir örneklerdir. Kişiye özel sağlık veya egzersiz reçetesi oluşturulmaz.

## Bu depoya bağlı hizmetler

- Kaynak kod: https://github.com/ozgeonline/gymrota-online
- Supabase proje adı: GymRota Online
- Supabase proje kimliği: `yfocwizfxagncpqtgtuo`
- Yayın: GitHub Pages iş akışı. Gerçek yayın durumunu Actions ve Settings → Pages ekranından kontrol et; başarılı dağıtımın verdiği URL'yi kullan.

`config/public.json` yalnızca tarayıcıda kullanılabilen Supabase URL'si ve **publishable** anahtarını içerir. Bu değerler bilinçli olarak herkese açıktır. Yönetici anahtarı, veritabanı şifresi ve kullanıcı parolası depoda bulunmaz.

## İlk kurulumda tamamlanacak panel ayarları

1. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions** seç. Gerekirse Actions → “Test and publish GymRota Online” → Run workflow ile yeniden başlat.
2. Supabase → Authentication → Sign In / Providers → **Allow new users to sign up** seçeneğini kapat. Anonymous sign-ins da kapalı olmalı; Email/password açık kalsın. Sadece uygulamada kayıt düğmesinin bulunmaması API üzerinden yeni hesap açılmasını engellemez.
3. Supabase → Authentication → Users → Add user/Create user ile her kullanıcıya ayrı e-posta/şifre hesabı aç. Yönetici hesabı oluştururken e-posta doğrulamasını uygun şekilde tamamla. Şifreleri bu depoya koyma. Kullanıcı giriş yaptıktan sonra “Şifre” ekranında mevcut şifresini girerek değiştirebilir.
4. Başarılı dağıtımın gerçek URL'sini Supabase → Authentication → URL Configuration → Site URL ve Redirect URLs alanlarına ekle. GitHub proje sayfasının `/gymrota-online/` yolunu dahil et.

Giriş, hesap oluşturma ve Supabase Auth panel ayarları için yönetici anahtarı tarayıcıya eklenmez. Parola sıfırlama e-postası varsayılan olarak kapalıdır; SMTP teslimatı ve yönlendirmeler test edildikten sonra yapılandırmadan açılabilir.

## Geliştirme ve yayın

Node.js 24:

```sh
npm ci
npm run build
npm test
```

`dist/` yayın dosyalarıdır. CI yalnızca bu dizini GitHub Pages'e yükler. Ek barındırma eklentisi veya elle dosya yükleme gerekmez. `artifacts/GymRota_Online_Onizleme.html` derleme sırasında oluşan, gerçek hesap kullanmayan bağımsız yerel önizlemedir; demo kayıtları sadece açıldığı tarayıcıda kalır.

Supabase bağlantısını değiştirmek için `config/public.json` güncellenebilir. Yerel geliştirmede `.env.example` → `.env` ile `SUPABASE_URL` ve `SUPABASE_PUBLISHABLE_KEY` birlikte verilerek dosyadaki ayarlar geçersiz kılınabilir. `ENABLE_PASSWORD_RESET=true/false` isteğe bağlıdır. Secret veya `service_role` anahtarları derlemede reddedilir. `.env`, `node_modules`, `dist` ve `artifacts` Git dışında kalır.

## Veritabanı ve erişim

`supabase/migrations/` içinde kurulum SQL'i bulunur. Bağlı canlı projeye ilk kurulum uygulanmıştır; aynı migration'ı tekrar elle çalıştırma. Başka projeye taşırken migration akışını kullan.

- `gym_programs`: program sahibi, tarihler, haftalık çalışma tanımı ve düzenleme sürümü.
- `gym_entries`: program + tarih + hareket için tamamlanma tiki.
- `gym_notes`: program + tarih için not.

Tüm tablolarda RLS açıktır; SELECT/INSERT/UPDATE/DELETE işlemleri `auth.uid() = user_id` ile sınırlandırılır. Bileşik foreign key ve tetikleyiciler başka kullanıcının programına kayıt bağlanmasını engeller. Sahiplik alanları değiştirilemez. Yönetici/service-role yetkisi RLS'yi aşabilir; bu anahtar istemcide kullanılmaz.

Canlı programlar localStorage'a kopyalanmaz. Supabase SDK oturumu tarayıcıda saklar; çıkış ekran belleğini temizler ve gecikmiş isteklerin önceki hesabı geri getirmesi engellenir. Başka cihazdaki değişiklikler sayfa yenilendiğinde yüklenir. Eşzamanlı program düzenlemelerinde sürüm çakışması bildirilir; tik/not için son başarılı kayıt geçerlidir.

## Doğrulama

`npm test` takvim hesabını, tarihli ilerlemeyi, kayıt hatalarını, API sayfalamasını, DOM ortamında program oluşturma/tik/not/çıkış akışını ve sahte Auth taşıyıcısıyla oturum değişimini denetler. PostgreSQL/PGlite testi iki kullanıcı ve anonim rolle SQL/RLS kurallarını çalıştırır. Gerçek Supabase projesinin RLS ve API erişimi de ayrıca doğrulanır. Bunlar gerçek kullanıcıyla tarayıcıdan giriş testinin yerine geçmez.

Canlı Auth entegrasyonu için yönetici tarafından açılmış iki geçici test hesabıyla:

```sh
npm run test:live
```

Kimlik bilgileri `.env` veya ortamdan `TEST_A_EMAIL`, `TEST_A_PASSWORD`, `TEST_B_EMAIL`, `TEST_B_PASSWORD` ile verilir. Komut yalnızca kendisinin oluşturduğu “Isolation check” programlarını temizler. Test parolalarını Git'e, terminal komut argümanlarına veya sohbet mesajlarına koyma.

Yayın sonrası masaüstü ve telefonda giriş, yeni plan, video bağlantısı, tik/not kaydı, sayfa yenileme ve çıkış kontrol edilmeli. Free Supabase projesi duraklatılırsa giriş ve kayıt için proje tekrar etkinleştirilmelidir.

## Resmî belgeler

- [Supabase Auth ayarları](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Pages iş akışları](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
