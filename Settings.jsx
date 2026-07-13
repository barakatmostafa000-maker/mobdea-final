import { useRef, useState } from 'react';
import { speakWelcome } from '../services/voice';
import { downloadBackup, readBackupFile } from '../services/backup';
import { pullCloudData, pushCloudData, testCloudConnection } from '../services/cloudSync';

export default function Settings({ data, updateData, resetAppData }) {
  const [pin, setPin] = useState(data.settings.adminPin || '');
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef(null);

  const patchSettings = (patch) => updateData({ ...data, settings: { ...data.settings, ...patch } });
  const patchVisible = (key, value) => patchSettings({ visibleModules: { ...data.settings.visibleModules, [key]: value } });
  const patchCloud = (patch) => patchSettings({ cloudSync: { ...data.settings.cloudSync, ...patch } });

  const savePin = () => {
    if (!/^\d{4,6}$/.test(pin)) { setNotice('PIN يجب أن يكون من 4 إلى 6 أرقام'); return; }
    patchSettings({ adminPin: pin });
    setNotice('تم حفظ PIN');
  };

  const restore = async (file) => {
    try {
      const restored = await readBackupFile(file);
      await updateData(restored);
      setNotice('تمت استعادة النسخة الاحتياطية بنجاح');
    } catch (error) {
      setNotice(error.message || 'تعذر استعادة النسخة');
    }
  };

  const testCloud = async () => {
    setSyncing(true);
    try { await testCloudConnection(data.settings); setNotice('تم الاتصال بخادم المزامنة بنجاح'); }
    catch (error) { setNotice(error.message); }
    finally { setSyncing(false); }
  };

  const pushCloud = async () => {
    setSyncing(true);
    try {
      await pushCloudData(data);
      await patchCloud({ lastPushAt: new Date().toISOString() });
      setNotice('تم رفع نسخة المنصة إلى السحابة');
    } catch (error) { setNotice(error.message); }
    finally { setSyncing(false); }
  };

  const pullCloud = async () => {
    if (!window.confirm('سيتم استبدال البيانات المحلية بآخر نسخة سحابية. هل تريد المتابعة؟')) return;
    setSyncing(true);
    try {
      const payload = await pullCloudData(data.settings);
      const restored = {
        ...payload.data,
        settings: {
          ...payload.data.settings,
          cloudSync: { ...data.settings.cloudSync, lastPullAt: new Date().toISOString() }
        }
      };
      await updateData(restored);
      setNotice('تم تنزيل النسخة السحابية واستعادتها');
    } catch (error) { setNotice(error.message); }
    finally { setSyncing(false); }
  };

  const cloud = data.settings.cloudSync || {};

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">الحماية والتحكم</span><h2>إعدادات المنصة</h2><p>حدد ما يظهر، فعّل القفل، وتحكم في الصوت والنسخ والمزامنة.</p></div></div>
    {notice && <div className="settings-notice">{notice}</div>}
    <div className="settings-grid">
      <article className="panel"><h3>الحماية</h3>
        <label className="setting-row"><span>تفعيل قفل الإدارة</span><input type="checkbox" checked={data.settings.lockEnabled} onChange={(e) => patchSettings({ lockEnabled: e.target.checked })}/></label>
        <label className="setting-row"><span>PIN الإدارة</span><input value={pin} inputMode="numeric" maxLength="6" onChange={(e) => setPin(e.target.value.replace(/\D/g,''))}/></label>
        <label className="setting-row"><span>القفل بعد عدم الاستخدام</span><select value={data.settings.lockAfterMinutes || 10} onChange={(e)=>patchSettings({lockAfterMinutes:Number(e.target.value)})}><option value="5">5 دقائق</option><option value="10">10 دقائق</option><option value="20">20 دقيقة</option><option value="30">30 دقيقة</option></select></label>
        <button className="primary-btn" onClick={savePin}>حفظ PIN</button>
      </article>

      <article className="panel"><h3>التحكم فيما يظهر</h3>
        {Object.entries({ games:'الألعاب', grades:'الدرجات', payments:'الحسابات', reports:'التقارير', messages:'رسائل أولياء الأمور' }).map(([key,label]) =>
          <label className="setting-row" key={key}><span>{label}</span><input type="checkbox" checked={data.settings.visibleModules[key] !== false} onChange={(e) => patchVisible(key,e.target.checked)}/></label>
        )}
      </article>

      <article className="panel"><h3>الصوت والتشجيع</h3>
        <label className="setting-row"><span>تشغيل الأصوات</span><input type="checkbox" checked={data.settings.voiceEnabled} onChange={(e)=>patchSettings({voiceEnabled:e.target.checked})}/></label>
        <label className="setting-row"><span>الترحيب عند الفتح</span><input type="checkbox" checked={data.settings.welcomeVoice} onChange={(e)=>patchSettings({welcomeVoice:e.target.checked})}/></label>
        <label className="setting-row"><span>مستوى الصوت</span><input type="range" min="0" max="1" step="0.1" value={data.settings.voiceVolume} onChange={(e)=>patchSettings({voiceVolume:Number(e.target.value)})}/></label>
        <button className="secondary-btn" onClick={()=>speakWelcome(data.settings)}>تجربة صوت الترحيب</button>
      </article>

      <article className="panel cloud-settings"><h3>المزامنة السحابية</h3><p className="settings-help">تعمل المنصة Offline بدون إعداد. بعد نشر خادم المزامنة يمكنك الرفع والتنزيل من أي جهاز.</p>
        <label><span>رابط الخادم</span><input placeholder="https://mobdea-sync...workers.dev" value={cloud.endpoint || ''} onChange={(e)=>patchCloud({endpoint:e.target.value.trim()})}/></label>
        <label><span>مساحة العمل</span><input placeholder="mostafa-center-main" value={cloud.workspaceId || ''} onChange={(e)=>patchCloud({workspaceId:e.target.value.trim()})}/></label>
        <label><span>الرمز السري</span><input type="password" value={cloud.token || ''} onChange={(e)=>patchCloud({token:e.target.value})}/></label>
        <div className="backup-actions"><button className="secondary-btn" disabled={syncing} onClick={testCloud}>اختبار الاتصال</button><button className="primary-btn" disabled={syncing} onClick={pushCloud}>رفع الآن</button><button className="secondary-btn" disabled={syncing} onClick={pullCloud}>تنزيل الآن</button></div>
        {(cloud.lastPushAt || cloud.lastPullAt) && <small className="sync-times">آخر رفع: {cloud.lastPushAt || '—'}<br/>آخر تنزيل: {cloud.lastPullAt || '—'}</small>}
      </article>

      <article className="panel"><h3>النسخ الاحتياطي</h3><p className="settings-help">صدّر كل الطلاب والحضور والدرجات والحسابات والرسائل والألعاب في ملف واحد مع فحص سلامة.</p>
        <div className="backup-actions"><button className="primary-btn" onClick={()=>downloadBackup(data)}>تصدير نسخة احتياطية</button><button className="secondary-btn" onClick={()=>fileRef.current?.click()}>استعادة نسخة</button></div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e)=>e.target.files?.[0]&&restore(e.target.files[0])}/>
      </article>

      <article className="panel"><h3>البيانات التجريبية</h3><button className="danger-btn" onClick={async()=>updateData(await resetAppData())}>إعادة البيانات التجريبية</button></article>
    </div>
  </section>;
}
