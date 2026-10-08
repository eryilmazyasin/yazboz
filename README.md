# Yazboz

Okey ve 101 masaları için telefondan kullanılabilen, canlı puan tablosu. Uygulama Next.js App Router, Supabase Free ve Netlify Free ile çalışacak şekilde hazırlanmıştır. Özel alan adı veya ücretli API gerekmez.

## Özellikler

- Dört kişilik Okey veya 101 masası oluşturma
- Paylaşılabilir bağlantıyla salt okunur canlı takip
- Masa sahibinin el puanlarını eklemesi, düzenlemesi, silmesi ve oyunu bitirmesi
- En düşük toplam puana göre sıralama
- Masa verisini yalnızca yetki kontrolü yapan Supabase RPC fonksiyonları üzerinden okuma/yazma

## Supabase kurulumu (ücretsiz katman)

1. Supabase Free üzerinde bir proje oluşturun.
2. Yeni bir Supabase projesiyse SQL Editor'de migration dosyalarını ad sırasına göre çalıştırın: önce `20261008000000_create_yazboz.sql`, sonra `20261008010000_add_play_mode.sql`. İlk migration'ı daha önce çalıştırdıysanız yalnızca ikinci migration'ı çalıştırın.
3. Supabase Realtime ayarlarında public channel erişiminin açık olduğunu doğrulayın. Oda kimliği rastgele UUID olduğundan yayın yalnızca masa bağlantısını bilen katılımcılara yönelir.
4. Project Connect/Settings sayfasından Project URL ve publishable key değerlerini alın.
5. Proje kökünde `.env.local` oluşturup `.env.example` içindeki değişkenleri doldurun:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

6. Geliştirme sunucusunu çalıştırın:

   ```bash
   npm install
   npm run dev
   ```

Publishable key tarayıcı uygulamalarında kullanılmak üzere tasarlanmıştır. `service_role` veya secret key'i istemciye koymayın. Tabloda doğrudan anon erişimi kapalıdır; okuma ve değişiklikler veritabanı fonksiyonlarıyla sınırlandırılır. Sahip anahtarının özeti saklanır, ham anahtar yalnızca masa sahibinin tarayıcısında tutulur.

## Netlify Free dağıtımı

1. Depoyu ücretsiz Netlify hesabınıza bağlayın.
2. Netlify site ayarlarına `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ortam değişkenlerini ekleyin.
3. Build komutu `npm run build` olarak ayarlanır; `netlify.toml` Node 22'yi seçer.
4. Netlify'ın sağladığı ücretsiz `*.netlify.app` adresini paylaşın.

Netlify Free ve Supabase Free kotaları aşılırsa uygulama geçici olarak durabilir. Supabase Free projeleri bir haftalık etkin olmama sonrasında duraklatabilir. Bu kurulumda otomatik ücretlendirme veya ücretli plana geçiş yapılandırılmaz.

## Puanlama ve masa yetkisi

Okey ve 101 yalnızca masa türünü belirtir; oyun kuralları ve otomatik ceza hesabı uygulanmaz. Her el için dört oyuncunun tam sayı puanı girilir. Yeni masayı oluşturan tarayıcı yazma yetkisini `localStorage` içinde tutar; aynı paylaşım bağlantısını açan diğer tarayıcılar salt okunurdur. Tarayıcı verisi silinir veya cihaz değiştirilirse sahiplik devredilemez.
# yazboz
