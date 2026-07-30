# بناء Android Release موقّع

## 1. إنشاء Keystore مرة واحدة

```bash
keytool -genkeypair \
  -v \
  -keystore mobdea-release.jks \
  -alias mobdea \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

احتفظ بالملف وكلمات المرور خارج المستودع وفي نسخة احتياطية آمنة. فقدان مفتاح التوقيع قد يمنع تحديث التطبيق المثبت بنفس الهوية.

## 2. بناء محلي

صدّر المتغيرات التالية في بيئة الطرفية:

```bash
export MOBDEA_KEYSTORE_PATH="/absolute/path/mobdea-release.jks"
export MOBDEA_KEYSTORE_PASSWORD="..."
export MOBDEA_KEY_ALIAS="mobdea"
export MOBDEA_KEY_PASSWORD="..."
```

ثم:

```bash
npm ci
npm run android:release
```

المخرجات المتوقعة:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## 3. إعداد GitHub Actions

حوّل Keystore إلى Base64 دون إدخال أسطر جديدة، ثم خزّن الناتج كسر:

```bash
base64 -w 0 mobdea-release.jks
```

أضف GitHub Actions Secrets التالية:

- `MOBDEA_KEYSTORE_BASE64`
- `MOBDEA_KEYSTORE_PASSWORD`
- `MOBDEA_KEY_ALIAS`
- `MOBDEA_KEY_PASSWORD`

وأضف GitHub Actions Variable:

- `MOBDEA_APK_URL`: رابط HTTPS النهائي الذي سيُنشر عليه APK، مثل رابط خادم تنزيل ثابت تملكه.

سيرفض Workflow إصدار Manifest عندما تكون القيمة فارغة أو ليست HTTPS.

## 4. تشغيل الإصدار

يمكن تشغيل Workflow يدويًا أو دفع Tag:

```bash
git tag v9.2.0
git push origin v9.2.0
```

Workflow يقوم بما يلي:

1. تثبيت الحزم من `package-lock.json`.
2. تشغيل الاختبارات والفحوص وProduction Build.
3. مزامنة Capacitor.
4. تشغيل Android Lint وUnit Tests.
5. بناء APK وAAB موقّعين.
6. التحقق من توقيع APK باستخدام `apksigner`.
7. إنشاء `update.manifest.json` متضمنًا الحجم وSHA-256 والرابط الآمن.

## 5. نشر التحديث

ارفع APK إلى نفس رابط `MOBDEA_APK_URL`، وارفع Manifest إلى عنوان HTTPS تضبطه داخل التطبيق. لا تستخدم HTTP ولا رابطًا يعيد التوجيه إلى مصدر غير موثوق.

التطبيق يتحقق قبل فتح المثبت من:

- HTTPS.
- حجم الملف المتوقع.
- SHA-256.
- اسم الحزمة `com.mobdea.education`.
- تطابق شهادة التوقيع مع النسخة المثبتة.

## 6. اختبار ما قبل النشر

- ثبّت نسخة Release على جهاز اختبار حقيقي.
- اختبر الترقية فوق الإصدار السابق دون فقد البيانات.
- اختبر النسخ الاحتياطي والاستعادة.
- اختبر الكاميرا والصوت وفتح PDF ومشاركة الحصة.
- اختبر المزامنة من جهازين وتعارض التعديلات.
- تحقق من أن رابط APK وManifest يعملان عبر HTTPS دون مصادقة متصفح تفاعلية.
