# بناء ونشر منصة المُبدع 10.1.0

## على Codespaces

```bash
cd /workspaces/mobdea-final
npm ci
npm run verify
npx cap sync android
cd android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew clean assembleDebug
```

مسار APK التجريبي:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## نشر تطبيق الطلاب

- ارفع المشروع إلى فرع `main`.
- فعّل GitHub Pages باستخدام GitHub Actions.
- Workflow: `.github/workflows/deploy-student-pwa.yml`.
- أرسل رابط Pages للطلاب مرة واحدة.

## قبل التوزيع

- نفّذ اختبار جهاز Android حقيقي.
- اختبر تسجيل الشاشة والصوت.
- اختبر الحصة بين شبكتين مختلفتين.
- اختبر رابط PWA بعد نشر HTTPS.
- انشر Cloud Worker واختبر صلاحيات الطالب والمعلم.
- استخدم توقيع Release ثابت عند بناء APK حتى يقبل Android التحديث فوق النسخة السابقة.
