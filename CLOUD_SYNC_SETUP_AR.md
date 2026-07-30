# إعداد المزامنة السحابية الآمنة

تستخدم المزامنة:

- Cloudflare Worker للواجهة البرمجية.
- KV لحفظ بيانات التطبيق المشفرة.
- R2 لحفظ الصور وPDF والصوت والفيديو بصورة مشفرة.
- Token مستقل لكل مساحة عمل.

## 1. تثبيت Wrangler وتسجيل الدخول

```bash
npm install --global wrangler
wrangler login
```

## 2. إنشاء KV وR2

من داخل مجلد `cloud-worker`:

```bash
wrangler kv namespace create MOBDEA_DATA
wrangler r2 bucket create mobdea-assets
wrangler r2 bucket create mobdea-assets-preview
```

انسخ `wrangler.toml.example` إلى `wrangler.toml`، ثم ضع معرّف KV الحقيقي. عدّل أسماء حاويات R2 عند استخدام أسماء مختلفة.

لا ترفع `wrangler.toml` إلى مستودع عام عندما يحتوي على بيانات خاصة ببيئتك.

## 3. إعداد Tokens مساحات العمل

أنشئ Token عشوائيًا طويلًا لكل مؤسسة أو فرع. مثال لتوليد قيمة آمنة:

```bash
openssl rand -hex 32
```

ثم خزّن خريطة JSON كسر:

```bash
wrangler secret put MOBDEA_WORKSPACE_TOKENS
```

مثال القيمة التي تُلصق عند الطلب:

```json
{
  "school-one": "TOKEN_UNIQUE_AT_LEAST_24_CHARACTERS",
  "school-two": "ANOTHER_UNIQUE_TOKEN_AT_LEAST_24_CHARACTERS"
}
```

لا تستخدم Token واحدًا لمساحتين.

## 4. إعداد مفتاح التشفير

```bash
openssl rand -hex 32
wrangler secret put MOBDEA_ENCRYPTION_KEY
```

ألصق القيمة المولدة. احتفظ بها في مدير أسرار. تغييرها بعد رفع البيانات يمنع فك البيانات القديمة.

## 5. تحديد أصول الويب المسموحة

```bash
wrangler secret put MOBDEA_ALLOWED_ORIGINS
```

مثال:

```text
https://app.example.com,https://www.example.com
```

طلبات تطبيق Android الأصلية لا تحمل `Origin`، لكنها تظل مطالبة بالمصادقة الصحيحة.

## 6. النشر

```bash
wrangler deploy
```

## 7. إعداد التطبيق

من إعدادات منصة المُبدع أدخل:

- رابط Worker كاملًا باستخدام HTTPS.
- اسم مساحة العمل المطابق لمفتاح JSON.
- Token الخاص بهذه المساحة فقط.

نفّذ اختبار الاتصال، ثم ارفع البيانات. عند وجود نسخة سحابية أحدث، سيرفض الخادم الكتابة القديمة بدل مسح التغييرات الجديدة.

## 8. النسخ الاحتياطي والتدوير

- أنشئ نسخة احتياطية مشفرة قبل تغيير إعدادات Worker.
- لتغيير Token مساحة واحدة، عدّل `MOBDEA_WORKSPACE_TOKENS` وحدّث التطبيق في هذه المساحة.
- لا تدوّر مفتاح التشفير دون خطة ترحيل للبيانات.
- راقب استهلاك KV وR2 وحدود الحساب من لوحة Cloudflare.
