# DDH app module map

Current safe split:
- index.html: markup only
- css/style.css: all visual styling
- js/data.js: preloaded static data exports
- js/app.js: current runtime, Firebase, filters, renderers, animation

Next extraction targets:
- js/firebase.js: Firebase config, auth, load/save
- js/filters.js: date and machine filtering helpers
- js/renderDashboard.js: dashboard cards, charts and drill status panel
- js/renderKuyular.js: underground well list, edit/delete row rendering
- js/animation.js: canvas rig drawing and animation loop

Keep app.js as the integration shell while moving one module at a time.

## Hakediş approval email pilot

The review action uses a Firebase callable function in `functions/` to send a
single Outlook email to the configured test mailbox. The email link opens the
app's “Kontrol Bekliyor” list after the reviewer signs in. A failed email send
does not move the hakediş into the review state.

Before enabling the pilot:

1. Confirm that the Firebase project uses the Blaze plan and that SMTP AUTH is
   enabled for the Microsoft 365 mailbox.
2. From the `functions/` directory, install dependencies with `npm install`.
3. Copy `functions/.env.example` to `functions/.env.ddh-gumustas`.
4. Set the Outlook SMTP password as a Firebase secret; do not put it in a
   source file or commit it:
   `firebase functions:secrets:set OUTLOOK_SMTP_PASSWORD --project ddh-gumustas`
5. Deploy the function:
   `firebase deploy --only functions --project ddh-gumustas`

The initial pilot is restricted to `eray.demircan@gumustasmaden.com.tr` as
both the test sender and approver. The same address is configured in the app
and the server function. Do not add real approvers until role management and
the server-side authorization rules are expanded beyond this single-user test.

Microsoft's current Exchange Online Basic authentication policy is documented
at [Deprecation of Basic authentication in Exchange Online](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online).

## Aylık hakediş arşivi

Hakediş ekranında bir veya daha fazla kuyu seçim menüsünden seçilip ay
belirlendikten sonra “Seçili Kuyuları Arşivle” ile o anki hesapların değişmez
kopyaları kaydedilir. Kuyular tek ay etiketiyle arşivlenir, ancak ayrı bölge
başlıklarına (ör. Bolkar-1 · Ekim 2026 ve Bolkar-2 · Ekim 2026) bölünür. Her
kayıt kullanıcı/zaman, USD/TL kuru, metraj, bekleme, kesintiler, finansal
toplamlar ve kuyu detaylarını içerir. Aynı bölge ve ay için tekrar kaydetmek
önceki kopyayı değiştirmez; yeni bir arşiv girdisi oluşturur.

Delgi, bekleme ve kuyu içi ölçüm poz tarifelerinde %5 indirim 1 Eylül 2026
itibarıyla geçerlidir. Tamamlanmış kuyuların tüm delgi metrajı ve kuyu içi
ölçüm fiyatı kuyu bitiş tarihindeki tarifeye göre belirlenir; tamamlanmamış
kuyularda delgi günlük kayıt tarihini izler. Bekleme fiyatı her zaman bekleme
kayıt tarihini izler. Eylül 2026 ve sonrası hesaplarda tarife ve finans
tutarları Ayarlar'daki güncel değerlerden alınır; kontrol anında alınmış eski
fiyat snapshot'ları bu döneme uygulanmaz. Arşiv ayı seçimi mevcut toplam
hakedişi etiketler.

BYA-947 kuyusunun Temmuz 2026 hakedişindeki tüm delgi metrajı, derinlik
kademelerinden bağımsız olarak $70/m birim fiyatla hesaplanır.

Arşiv, mevcut hakediş verisiyle aynı Firebase veri kaydında tutulur ve yerel
yedekleme akışına da dahildir. Bu özellik e-posta gönderimi gerektirmez.