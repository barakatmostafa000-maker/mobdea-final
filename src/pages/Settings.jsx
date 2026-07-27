import { useRef, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { speakWelcome, playVoiceClip } from '../services/voice';
import { createPinSecret, createRecoverySecret } from '../utils/security';
import { downloadBackup, readBackupFile } from '../services/backup';
import { pullCloudData, pushCloudData, testCloudConnection } from '../services/cloudSync';

const clipTypes = [
  ['welcome', 'الترحيب'],
  ['excellent', 'ممتاز'],
  ['close', 'قريبة'],
  ['retry', 'حاول تاني'],
  ['calm', 'هدوء'],
  ['comic', 'كوميدي'],
  ['correct', 'صوت الإجابة الصحيحة'],
  ['wrong', 'صوت الخطأ'],
  ['win', 'صوت الفوز']
];

export default function Settings({ data, updateData, resetAppData }) {
  const [pin, setPin] = useState('');
  const [teacherPin, setTeacherPin] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState(data.settings.staffRecoveryQuestion || '');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [clipTitle, setClipTitle] = useState('');
  const [clipType, setClipType] = useState('excellent');
  const [clipText, setClipText] = useState('');
  const [clipInfo, setClipInfo] = useState('');
  const fileRef = useRef(null);
  const clipFileRef = useRef(null);

  const patchSettings = (patch) => updateData({ ...data, settings: { ...data.settings, ...patch } });
  const patchVisible = (key, value) => patchSettings({ visibleModules: { ...data.settings.visibleModules, [key]: value } });
  const patchCloud = (patch) => patchSettings({ cloudSync: { ...data.settings.cloudSync, ...patch } });

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(pin)) { setNotice('PIN يجب أن يكون من 4 إلى 6 أرقام'); return; }
    const secret = await createPinSecret(pin, 'admin');
    await patchSettings({ adminPin: '', adminPinHash: secret.adminPinHash, adminPinSalt: secret.adminPinSalt });
    setPin('');
    setNotice('تم حفظ رقم الإدارة السري بشكل آمن');
  };

  const saveTeacherPin = async () => {
    if (!/^\d{4,6}$/.test(teacherPin)) { setNotice('PIN يجب أن يكون من 4 إلى 6 أرقام'); return; }
    const secret = await createPinSecret(teacherPin, 'teacher');
    await patchSettings({ teacherPin: '', teacherPinHash: secret.teacherPinHash, teacherPinSalt: secret.teacherPinSalt });
    setTeacherPin('');
    setNotice('تم حفظ رقم المعلم السري بشكل آمن');
  };

  const saveRecovery = async () => {
    if (!recoveryQuestion.trim()) { setNotice('اكتب سؤال الاسترجاع أولًا'); return; }
    if (!recoveryAnswer.trim()) { setNotice('اكتب إجابة سؤال الاسترجاع'); return; }
    const secret = await createRecoverySecret(recoveryAnswer);
    await patchSettings({ staffRecoveryQuestion: recoveryQuestion.trim(), staffRecoveryAnswerHash: secret.staffRecoveryAnswerHash, staffRecoveryAnswerSalt: secret.staffRecoveryAnswerSalt });
    setRecoveryAnswer('');
    setNotice('تم حفظ سؤال الاسترجاع، ويمكن استخدامه من شاشة الدخول عند نسيان الرقم السري');
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

  const addVoiceClip = async (file) => {
    if (!file) return;
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    const nextClip = {
      id: Date.now(),
      title: clipTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
      phraseType: clipType,
      text: clipText.trim(),
      url,
      mimeType: file.type,
      fileName: file.name,
      createdAt: new Date().toISOString()
    };
    const voiceClips = [...(data.settings.voiceClips || []), nextClip];
    patchSettings({ voiceClips });
    setClipInfo(`تمت إضافة الصوت: ${nextClip.title}`);
    setClipTitle('');
    setClipText('');
    if (clipFileRef.current) clipFileRef.current.value = '';
  };

  const removeVoiceClip = (id) => {
    const voiceClips = (data.settings.voiceClips || []).filter((clip) => clip.id !== id);
    patchSettings({ voiceClips });
  };

  const previewClip = (clip) => {
    if (!clip?.url) return;
    const played = playVoiceClip({ voiceClips: [clip] }, clip.phraseType);
    if (!played) setNotice('تعذر تشغيل الصوت.');
  };

  const cloud = data.settings.cloudSync || {};
  const voiceClips = Array.isArray(data.settings.voiceClips) ? data.settings.voiceClips : [];

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">الحماية والتحكم</span><h2>إعدادات المنصة</h2><p>حدد ما يظهر، فعّل القفل، وتحكم في الصوت والنسخ والمزامنة.</p></div></div>
    {notice && <div className="settings-notice">{notice}</div>}
    <div className="settings-grid">
      <article className="panel"><h3>الحماية</h3>
        <label className="setting-row"><span>تفعيل قفل الإدارة</span><input type="checkbox" checked={data.settings.lockEnabled} onChange={(e) => patchSettings({ lockEnabled: e.target.checked })}/></label>
        <label className="setting-row"><span>PIN الإدارة</span><input value={pin} inputMode="numeric" maxLength="6" placeholder={data.settings.adminPinHash ? '•••••• (مفعّل)' : 'اختر رقمًا سريًا'} onChange={(e) => setPin(e.target.value.replace(/\D/g,''))}/></label>
        <label className="setting-row"><span>القفل بعد عدم الاستخدام</span><select value={data.settings.lockAfterMinutes || 10} onChange={(e)=>patchSettings({lockAfterMinutes:Number(e.target.value)})}><option value="5">5 دقائق</option><option value="10">10 دقائق</option><option value="20">20 دقيقة</option><option value="30">30 دقيقة</option></select></label>
        <button className="primary-btn" onClick={savePin}>حفظ PIN الإدارة</button>

        <label className="setting-row"><span>PIN المعلم</span><input value={teacherPin} inputMode="numeric" maxLength="6" placeholder={data.settings.teacherPinHash ? '•••••• (مفعّل)' : 'اختر رقمًا سريًا للمعلم'} onChange={(e) => setTeacherPin(e.target.value.replace(/\D/g,''))}/></label>
        <button className="secondary-btn" onClick={saveTeacherPin}>حفظ PIN المعلم</button>

        <div className="settings-divider" />
        <p className="settings-help">سؤال الاسترجاع يُستخدم لإعادة ضبط رقم المعلم أو الإدارة مباشرة من شاشة الدخول عند نسيانه.</p>
        <label className="setting-row"><span>سؤال الاسترجاع</span><input value={recoveryQuestion} placeholder="مثال: ما اسم أول مدرسة عملت بها؟" onChange={(e)=>setRecoveryQuestion(e.target.value)}/></label>
        <label className="setting-row"><span>الإجابة</span><input value={recoveryAnswer} placeholder={data.settings.staffRecoveryAnswerHash ? 'إجابة محفوظة — اكتب إجابة جديدة لتغييرها' : 'اكتب الإجابة'} onChange={(e)=>setRecoveryAnswer(e.target.value)}/></label>
        <button className="secondary-btn" onClick={saveRecovery}>حفظ سؤال الاسترجاع</button>
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

        <div className="voice-clips-box">
          <div className="voice-clips-header">
            <strong>أصوات مخصصة من الموبايل</strong>
            <small>اربط كل صوت بفئة تشجيعية</small>
          </div>
          <div className="voice-clip-form">
            <input placeholder="اسم الصوت" value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} />
            <select value={clipType} onChange={(e) => setClipType(e.target.value)}>
              {clipTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input placeholder="الجملة المكتوبة أو الوصف" value={clipText} onChange={(e) => setClipText(e.target.value)} />
            <button type="button" className="secondary-btn" onClick={() => clipFileRef.current?.click()}><Plus size={16}/> رفع ملف صوت</button>
          </div>
          <input ref={clipFileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" hidden onChange={(e) => addVoiceClip(e.target.files?.[0])} />
          <div className="voice-clips-list">
            {voiceClips.length ? voiceClips.map((clip) => (
              <div className="voice-clip-item" key={clip.id}>
                <div>
                  <strong>{clip.title}</strong>
                  <small>{clipTypes.find(([value]) => value === clip.phraseType)?.[1] || clip.phraseType} • {clip.fileName || clip.text || 'صوت مخصص'}</small>
                </div>
                <div className="voice-clip-actions">
                  <button className="secondary-btn" onClick={() => previewClip(clip)}><Play size={16}/> تشغيل</button>
                  <button className="secondary-btn danger-text" onClick={() => removeVoiceClip(clip.id)}><Trash2 size={16}/> حذف</button>
                </div>
              </div>
            )) : <small className="settings-help">لا توجد أصوات مخصصة بعد.</small>}
          </div>
          {clipInfo && <div className="settings-notice">{clipInfo}</div>}
        </div>
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

      <article className="panel"><h3>تحديث التطبيق</h3><p className="settings-help">يمكنك إضافة رابط ملف JSON عام يحتوي على version وapkUrl وnotes، وإن تُرك فارغًا ستستخدم المنصة ملفًا داخليًا آمنًا للمعاينة.</p>
        <label className="setting-row"><span>رابط Manifest</span><input value={data.settings.update?.manifestUrl || ''} placeholder="https://.../update.json" onChange={(e)=>patchSettings({update:{...(data.settings.update||{}),manifestUrl:e.target.value.trim()}})}/></label>
        <label className="setting-row"><span>الفحص عند فتح التطبيق</span><input type="checkbox" checked={data.settings.update?.autoCheck !== false} onChange={(e)=>patchSettings({update:{...(data.settings.update||{}),autoCheck:e.target.checked}})}/></label>
      </article>

      <article className="panel"><h3>البيانات التجريبية</h3><button className="danger-btn" onClick={async()=>updateData(await resetAppData())}>إعادة البيانات التجريبية</button></article>
    </div>
  </section>;
}
