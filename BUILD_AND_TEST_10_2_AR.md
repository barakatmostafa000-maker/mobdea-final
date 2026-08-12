# بناء واختبار منصة المُبدع 10.2.0

## 1. تثبيت الحزم والفحص

من جذر المشروع في Codespaces:

```bash
npm ci
npm test
npm run lint
npm run format:check
npm run build
npx cap sync android
```

## 2. إعداد Java وAndroid SDK

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME="$HOME/android-sdk"
export ANDROID_SDK_ROOT="$HOME/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
```

## 3. إنشاء APK تجريبي

```bash
cd android
./gradlew --stop
./gradlew clean assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../mobdea-v10.2-debug.apk
ls -lh ../mobdea-v10.2-debug.apk
```

المطلوب ظهور `BUILD SUCCESSFUL`، وسيكون الملف في جذر المشروع باسم:

```text
mobdea-v10.2-debug.apk
```

## 4. ترتيب الاختبار الحقيقي

- ثبّت APK كتحديث فوق النسخة القديمة، مع الاحتفاظ بنسخة احتياطية من البيانات.
- اختبر أولًا على الموبايل، ثم التابلت.
- ابدأ بحساب المعلم، ثم الطالب، ثم ولي الأمر.
- أنشئ درس اختبار جديدًا وأرفق PDF وصورة وفيديو وPowerPoint.
- افتح وضع الحصة وتحقق من التبويبات الستة وشاشة العرض.
- اختبر السبورة والخرائط والتسجيل والطباعة.
- للحصة الأونلاين: جهز Cloud Sync من الإعدادات أولًا، ثم اضغط «الحصة الأونلاين» وانسخ الرابط.

## 5. عدم اعتماد النسخة قبل هذه العلامات

- لا توجد شاشة بيضاء.
- لا يوجد تداخل بين القوائم وشاشة العرض.
- محتوى الدرس يظهر بعد الحفظ وإعادة فتح التطبيق.
- PDF الكروت يحتوي على الوجه والظهر فعلًا.
- رابط الحصة يفتح من جهاز طالب مختلف ويظهر طلب الميكروفون.
