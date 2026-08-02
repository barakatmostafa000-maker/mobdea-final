# تطبيق إصلاح 10.2 فوق مستودع 10.1

الحزمة `mobdea-v10.2-stability-patch.zip` تحتوي فقط على الملفات التي تغيرت، وتحافظ على بقية المشروع والبيانات.

من جذر المستودع في Codespaces:

```bash
unzip -oq mobdea-v10.2-stability-patch.zip -d .
rm -f mobdea-v10.2-stability-patch.zip
npm ci
npm test
npm run lint
npm run format:check
npm run build
npx cap sync android
```

ثم أنشئ APK وفق `BUILD_AND_TEST_10_2_AR.md`.
