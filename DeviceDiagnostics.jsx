import { useMemo, useState } from 'react';
import { Camera, Cloud, Database, Mic2, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import { cloudConfigured, testCloudConnection } from '../services/cloudSync';
import { speakArabic } from '../services/voice';

const statusLabel = (value) => value === true ? 'جاهز' : value === false ? 'غير متاح' : 'لم يُختبر';

export default function DeviceDiagnostics({ data }) {
  const [checks, setChecks] = useState({});
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');

  const base = useMemo(() => ({
    native: Boolean(window.Capacitor?.isNativePlatform?.()),
    online: navigator.onLine,
    barcode: 'BarcodeDetector' in window,
    speech: 'speechSynthesis' in window,
    storage: Boolean(window.localStorage)
  }), []);

  const run = async () => {
    setRunning(true);
    setNotice('');
    const result = { ...base };

    try {
      localStorage.setItem('mobdea-diagnostic', 'ok');
      result.storage = localStorage.getItem('mobdea-diagnostic') === 'ok';
      localStorage.removeItem('mobdea-diagnostic');
    } catch { result.storage = false; }

    try {
      const voices = speechSynthesis.getVoices();
      result.arabicVoice = voices.some((voice) => voice.lang?.toLowerCase().startsWith('ar'));
    } catch { result.arabicVoice = false; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      result.camera = true;
      stream.getTracks().forEach((track) => track.stop());
    } catch { result.camera = false; }

    if (cloudConfigured(data.settings)) {
      try {
        await testCloudConnection(data.settings);
        result.cloud = true;
      } catch (error) {
        result.cloud = false;
        result.cloudError = error.message;
      }
    } else {
      result.cloud = null;
    }

    setChecks(result);
    setRunning(false);
    setNotice('تم تنفيذ اختبارات الجهاز. اختبارات الكاميرا والصوت تحتاج موافقة الجهاز.');
  };

  const items = [
    ['native', 'تشغيل كتطبيق Android', Smartphone, 'يجب أن يظهر جاهز داخل APK، وقد يظهر غير متاح في المتصفح.'],
    ['online', 'الاتصال بالإنترنت', Wifi, 'مطلوب فقط للمزامنة والرسائل الخارجية.'],
    ['camera', 'إذن الكاميرا', Camera, 'مطلوب لمسح أكواد الطلاب.'],
    ['barcode', 'قارئ QR داخل WebView', Camera, 'عند عدم دعمه يظل إدخال الكود اليدوي متاحًا.'],
    ['speech', 'محرك النطق', Mic2, 'تشغيل الجمل التشجيعية.'],
    ['arabicVoice', 'صوت عربي مثبت', Mic2, 'يمكن تنزيل الصوت العربي من إعدادات تحويل النص إلى كلام في الجهاز.'],
    ['storage', 'التخزين المحلي', Database, 'يحفظ بيانات المنصة Offline.'],
    ['cloud', 'خادم المزامنة', Cloud, cloudConfigured(data.settings) ? (checks.cloudError || 'اختبار رابط المزامنة والرمز السري.') : 'لم يتم إعداد خادم المزامنة بعد.']
  ];

  return <section className="page">
    <div className="page-heading">
      <div><span className="eyebrow">اختبار Android الحقيقي</span><h2>تشخيص الجهاز</h2><p>شغّل الاختبار من داخل APK على الموبايل أو التابلت للتأكد من الكاميرا والصوت والتخزين والمزامنة.</p></div>
      <button className="primary-btn diagnostics-run" disabled={running} onClick={run}><RefreshCw size={18}/>{running ? 'جارٍ الاختبار...' : 'تشغيل كل الاختبارات'}</button>
    </div>
    {notice && <div className="settings-notice">{notice}</div>}
    <div className="diagnostics-grid">
      {items.map(([key,label,Icon,help]) => {
        const value = Object.prototype.hasOwnProperty.call(checks,key) ? checks[key] : (key in base ? base[key] : null);
        return <article className={`panel diagnostic-card ${value === true ? 'ok' : value === false ? 'fail' : 'pending'}`} key={key}>
          <Icon size={25}/><div><strong>{label}</strong><span>{statusLabel(value)}</span><small>{help}</small></div>
        </article>;
      })}
    </div>
    <div className="panel diagnostic-actions">
      <h3>اختبارات سريعة</h3>
      <button className="secondary-btn" onClick={() => speakArabic('والله مبدع يا أحمد، اختبار الصوت العربي يعمل بنجاح', data.settings)}>تجربة الصوت العربي</button>
      <p>الكاميرا لا يمكن تأكيدها نهائيًا من بيئة البناء؛ يلزم تشغيل APK ومنح إذن الكاميرا على الجهاز.</p>
    </div>
  </section>;
}
