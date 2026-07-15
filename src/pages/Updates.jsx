import { useState } from 'react';
import { Download, RefreshCw, ShieldCheck, Smartphone, History } from 'lucide-react';
import { checkForUpdate, openApkDownload } from '../services/updater';

const CURRENT_VERSION = '8.7.0';

export default function Updates({ data, updateData }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');

  const runCheck = async () => {
    setChecking(true); setNotice('');
    try {
      const next = await checkForUpdate(data.settings, CURRENT_VERSION);
      setResult(next);
      const history = [{ checkedAt: new Date().toISOString(), version: next.version, available: next.available }, ...(data.updateHistory || [])].slice(0, 20);
      await updateData({ ...data, updateHistory });
    } catch (error) { setNotice(error.message); }
    finally { setChecking(false); }
  };

  return <section className="page updates-page">
    <div className="page-heading"><div><span className="eyebrow">تحديثات آمنة</span><h2>تحديث منصة المُبدع</h2><p>فحص الإصدار، عرض التغييرات، وتنزيل APK الجديد مع الحفاظ على بياناتك.</p></div></div>
    {notice && <div className="settings-notice">{notice}</div>}
    <div className="updates-grid">
      <article className="panel current-version-card"><Smartphone/><span>الإصدار المثبت</span><strong>V{CURRENT_VERSION}</strong><small>حزمة التطبيق: com.mobdea.education</small></article>
      <article className="panel update-action-card"><ShieldCheck/><h3>فحص آخر إصدار</h3><p>يتم الاعتماد على ملف Manifest تحدده في الإعدادات.</p><button className="primary-btn" disabled={checking} onClick={runCheck}><RefreshCw size={18}/>{checking ? 'جارٍ الفحص...' : 'فحص الآن'}</button></article>
    </div>
    {result && <article className={`panel update-result ${result.available ? 'available' : 'latest'}`}>
      <div><span>{result.available ? 'إصدار جديد متاح' : 'أنت على أحدث إصدار'}</span><h3>V{result.version}</h3><p>{result.notes || 'تحسينات وإصلاحات جديدة.'}</p></div>
      {result.available && <button className="primary-btn" onClick={() => openApkDownload(result.apkUrl)}><Download size={18}/>تنزيل التحديث</button>}
    </article>}
    <article className="panel"><div className="panel-title"><h3>سجل الفحص</h3><History size={19}/></div>
      {(data.updateHistory || []).length ? data.updateHistory.map((item, i)=><div className="update-history-row" key={`${item.checkedAt}-${i}`}><span>{new Date(item.checkedAt).toLocaleString('ar-EG')}</span><b>V{item.version}</b><small>{item.available ? 'كان متاحًا' : 'أحدث إصدار'}</small></div>) : <div className="empty-state">لم يتم فحص أي تحديث بعد.</div>}
    </article>
  </section>;
}
