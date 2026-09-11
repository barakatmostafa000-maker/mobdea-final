// PROJECT12_STUDENT_DEFAULT_PIN_V1
import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { createCredentialSecret, normalizePin } from '../../utils/security';
import { changeStudentCloudPin } from '../../services/project12StudentCloud';

export default function Project12StudentPinGate({ auth, data, updateData, onAuthChange, onPortalData }) {
  const [open, setOpen] = useState(Boolean(auth?.mustChangePin));
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth?.mustChangePin) setOpen(true);
  }, [auth?.mustChangePin]);

  if (auth?.role !== 'student') return null;

  const close = () => {
    if (auth.mustChangePin) return;
    setOpen(false);
    setPin('');
    setConfirm('');
    setNotice('');
  };

  const save = async () => {
    const value = normalizePin(pin);
    if (!/^\d{6,10}$/.test(value)) return setNotice('اختر رقمًا من 6 إلى 10 أرقام.');
    if (value === '123456') return setNotice('اختَر رقمًا جديدًا غير 123456.');
    if (value !== normalizePin(confirm)) return setNotice('الرقمان غير متطابقين.');

    setBusy(true);
    setNotice('');
    try {
      if (auth.studentSessionToken) {
        const response = await changeStudentCloudPin(data.settings, auth.studentSessionToken, value);
        if (response.data) onPortalData?.(response.data);
        onAuthChange?.({ mustChangePin: false, studentPinChangedByStudentAt: response.changedAt || new Date().toISOString() });
      } else {
        const secret = await createCredentialSecret(value, 'student');
        await updateData((latest) => ({
          ...latest,
          students: (latest.students || []).map((student) =>
            String(student.id) === String(auth.studentId)
              ? { ...student, ...secret, studentPinMustChange: false, studentPinChangedByStudentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : student
          ),
        }));
        onAuthChange?.({ mustChangePin: false, studentPinChangedByStudentAt: new Date().toISOString() });
      }
      setPin('');
      setConfirm('');
      setOpen(false);
    } catch (error) {
      setNotice(error?.message || 'تعذر تغيير الرقم السري.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!auth.mustChangePin && (
        <button type="button" className="project12-change-pin-entry" onClick={() => setOpen(true)} title="تغيير الرقم السري">
          <KeyRound size={15}/><span>تغيير PIN</span>
        </button>
      )}

      {open && (
        <div className="project12-pin-gate" role="dialog" aria-modal="true">
          <div className="project12-pin-card">
            <ShieldCheck size={32}/>
            <span className="eyebrow">{auth.mustChangePin ? 'أول دخول' : 'أمان حساب الطالب'}</span>
            <h2>{auth.mustChangePin ? 'غيّر PIN المؤقت 123456' : 'تغيير الرقم السري'}</h2>
            <p>اختَر رقمًا خاصًا بك من 6 إلى 10 أرقام، ولا تستخدم 123456.</p>
            <label><span>PIN جديد</span><input type="password" inputMode="numeric" maxLength="10" value={pin} onChange={(e) => setPin(normalizePin(e.target.value))}/></label>
            <label><span>تأكيد PIN</span><input type="password" inputMode="numeric" maxLength="10" value={confirm} onChange={(e) => setConfirm(normalizePin(e.target.value))}/></label>
            {notice && <div className="settings-notice warning">{notice}</div>}
            <div className="project12-pin-actions">
              {!auth.mustChangePin && <button className="secondary-btn" type="button" onClick={close}>إلغاء</button>}
              <button className="primary-btn" type="button" disabled={busy} onClick={() => void save()}>{busy ? 'جارٍ الحفظ…' : 'حفظ الرقم الجديد'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
