# بناء نسخة Android النهائية

نفّذ من جذر المشروع داخل Codespaces:

```bash
npm ci
npm run verify
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
npm run build
npx cap sync android
cd android
./gradlew --stop
./gradlew clean assembleDebug
```

ستجد نسخة الاختبار هنا:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

قبل التسليم النهائي اختبر على الموبايل والتابلت: فتح التطبيق، وضع الحصة، الصوت العربي، PDF والرسم عليه، الصور، الفيديو، PowerPoint، الخرائط، حفظ الدروس، وطباعة الكروت.
