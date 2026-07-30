import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, KeyRound, UsersRound, ShieldCheck, UserRound, PersonStanding, ScanLine,
  ArrowRight, BadgeInfo, GraduationCap, Eye, EyeOff, HelpCircle, Check, X,
} from 'lucide-react';
import { identity } from '../config/identity';
import {
  assertLoginAllowed, clearLoginFailures, createPinSecret, hasCredentialSecret,
  normalizePin, recordLoginFailure, verifyCredentialSecret, verifyPinSecret, verifyRecoverySecret,
} from '../utils/security';
import {
  defaultAuthState, normalizeDigits, resolveGuardianByPhone, resolveStudentByCode,
  resolveStudentFromQrPayload, ROLE_LABELS,
} from '../utils/auth';

const roles = [
  { key: 'teacher', title: 'المعلم', hint: 'PIN آمن', icon: GraduationCap, pinPrefix: 'teacher' },
  { key: 'admin', title: 'الإدارة', hint: 'PIN آمن', icon: ShieldCheck, pinPrefix: 'admin' },
  { key: 'student', title: 'الطالب', hint: 'الكود + PIN', icon: UserRound, pinPrefix: 'student' },
  { key: 'guardian', title: 'ولي الأمر', hint: 'الهاتف + PIN', icon: UsersRound, pinPrefix: 'guardian' },
  { key: 'visitor', title: 'الزائر', hint: 'دخول محدود', icon: PersonStanding },
];

const STAFF_ROLES = new Set(['teacher', 'admin']);

function cleanQrPayload(payload) {
  if (payload == null) return null;
  return String(payload).trim();
}

export default function LockScreen({ data, onUnlock, updateData }) {
  const [role, setRole] = useState('teacher');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);

  const roleInfo = useMemo(() => roles.find((item) => item.key === role) || roles[0], [role]);
  const selectedLabel = ROLE_LABELS[role] || 'المستخدم';
  const staffConfigured = STAFF_ROLES.has(role) && hasCredentialSecret(data?.settings, roleInfo.pinPrefix);

  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setShowPin(false);
    setIdentifier('');
    setVisitorName('');
    setNotice('');
    setScanMessage('');
    setCameraOpen(false);
    setForgotOpen(false);
    setRecoveryAnswer('');
    setRecoveryNewPin('');
    setRecoveryConfirmPin('');
    setRecoveryNotice('');
    setRecoverySuccess(false);
  }, [role]);

  useEffect(() => () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;
    const openCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setScanMessage('الكاميرا غير مدعومة على هذا الجهاز.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!('BarcodeDetector' in window)) {
          setScanMessage('المسح التلقائي غير مدعوم؛ اكتب كود الطالب يدويًا.');
          return;
        }
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || !detectorRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            const value = cleanQrPayload(codes?.[0]?.rawValue);
            if (!value) return;
            const student = resolveStudentFromQrPayload(data, value);
            if (!student) { setScanMessage('تمت قراءة QR لكن الطالب غير موجود.'); return; }
            setIdentifier(String(student.code));
            setScanMessage(`تم اختيار الطالب: ${student.name}. أدخل PIN لإكمال الدخول.`);
            setCameraOpen(false);
          } catch {
            // Continue scan loop.
          }
        }, 1100);
      } catch (error) {
        setScanMessage(error?.message || 'تعذر فتح الكاميرا.');
      }
    };
    openCamera();
    return () => {
      cancelled = true;
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      detectorRef.current = null;
      streamRef.current = null;
    };
  }, [cameraOpen, data]);

  const failLogin = (scope, message) => {
    const throttle = recordLoginFailure(scope);
    if (throttle.blocked) {
      const seconds = Math.ceil(throttle.remainingMs / 1000);
      throw new Error(`بيانات الدخول غير صحيحة. تم إيقاف المحاولات لمدة ${seconds} ثانية.`);
    }
    throw new Error(message);
  };

  const handleUnlock = async () => {
    setLoading(true);
    setNotice('');
    try {
      if (STAFF_ROLES.has(role)) {
        const prefix = roleInfo.pinPrefix;
        const scope = `staff:${role}`;
        assertLoginAllowed(scope);
        if (!staffConfigured) {
          const normalized = normalizePin(pin);
          if (!/^\d{6,10}$/.test(normalized)) throw new Error('أنشئ PIN من 6 إلى 10 أرقام أولًا.');
          if (normalized !== normalizePin(confirmPin)) throw new Error('تأكيد PIN غير مطابق.');
          const secret = await createPinSecret(normalized, prefix);
          await updateData({ ...data, settings: { ...data.settings, ...secret, [`${prefix}Pin`]: '' } });
          clearLoginFailures(scope);
          onUnlock(defaultAuthState(role), { remember });
          return;
        }
        const ok = await verifyPinSecret(pin, data.settings, prefix);
        if (!ok) failLogin(scope, 'الرقم السري غير صحيح.');
        clearLoginFailures(scope);
        if (data.settings[`${prefix}PinAlgorithm`] !== 'PBKDF2-SHA256') {
          const upgraded = await createPinSecret(pin, prefix);
          await updateData({ ...data, settings: { ...data.settings, ...upgraded, [`${prefix}Pin`]: '' } });
        }
        onUnlock(defaultAuthState(role), { remember });
        return;
      }

      if (role === 'student') {
        const student = resolveStudentByCode(data, identifier) || resolveStudentFromQrPayload(data, identifier);
        const scope = `student:${normalizeDigits(identifier) || 'unknown'}`;
        assertLoginAllowed(scope);
        if (!student) failLogin(scope, 'كود الطالب أو PIN غير صحيح.');
        if (!hasCredentialSecret(student, 'student')) throw new Error('حساب الطالب غير مفعّل. اطلب من المعلم إنشاء PIN للطالب.');
        if (!(await verifyCredentialSecret(pin, student, 'student'))) failLogin(scope, 'كود الطالب أو PIN غير صحيح.');
        clearLoginFailures(scope);
        onUnlock(defaultAuthState('student', student), { remember });
        return;
      }

      if (role === 'guardian') {
        const phone = normalizeDigits(identifier);
        const scope = `guardian:${phone || 'unknown'}`;
        assertLoginAllowed(scope);
        const student = resolveGuardianByPhone(data, phone);
        if (!student) failLogin(scope, 'رقم الهاتف أو PIN غير صحيح.');
        if (!hasCredentialSecret(student, 'guardian')) throw new Error('حساب ولي الأمر غير مفعّل. تواصل مع المعلم لإنشاء PIN.');
        if (!(await verifyCredentialSecret(pin, student, 'guardian'))) failLogin(scope, 'رقم الهاتف أو PIN غير صحيح.');
        clearLoginFailures(scope);
        onUnlock(defaultAuthState('guardian', student), { remember });
        return;
      }

      onUnlock({ ...defaultAuthState('visitor'), displayName: visitorName.trim().slice(0, 80) || 'زائر' }, { remember: false });
    } catch (error) {
      setNotice(error?.message || 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const submitRecovery = async () => {
    setRecoveryNotice('');
    const scope = `recovery:${role}`;
    try {
      assertLoginAllowed(scope);
      const normalized = normalizePin(recoveryNewPin);
      if (!/^\d{6,10}$/.test(normalized)) throw new Error('اكتب PIN جديدًا من 6 إلى 10 أرقام.');
      if (normalized !== normalizePin(recoveryConfirmPin)) throw new Error('الرقمان غير متطابقين.');
      setRecoveryLoading(true);
      if (!(await verifyRecoverySecret(recoveryAnswer, data.settings))) failLogin(scope, 'عبارة الاسترجاع غير صحيحة.');
      const prefix = role === 'teacher' ? 'teacher' : 'admin';
      const secret = await createPinSecret(normalized, prefix);
      await updateData({ ...data, settings: { ...data.settings, ...secret, [`${prefix}Pin`]: '' } });
      clearLoginFailures(scope);
      setRecoverySuccess(true);
    } catch (error) {
      setRecoveryNotice(error?.message || 'تعذر استرجاع الحساب.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const closeRecovery = () => {
    setForgotOpen(false);
    setRecoveryAnswer('');
    setRecoveryNewPin('');
    setRecoveryConfirmPin('');
    setRecoveryNotice('');
    setRecoverySuccess(false);
  };

  const pinField = (label = 'PIN') => (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-pin-wrap">
        <input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={10} value={pin} onChange={(event) => setPin(normalizePin(event.target.value))} onKeyDown={(event) => event.key === 'Enter' && handleUnlock()} placeholder="6 إلى 10 أرقام" />
        <button type="button" className="auth-pin-eye" onClick={() => setShowPin((value) => !value)} aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}>{showPin ? <EyeOff size={17} /> : <Eye size={17} />}</button>
      </div>
    </label>
  );

  return (
    <div className="auth-screen">
      <div className="auth-background"><div className="auth-glow auth-glow-1" /><div className="auth-glow auth-glow-2" /><div className="auth-glow auth-glow-3" /></div>
      <section className="auth-card">
        <aside className="auth-brand-panel">
          <div className="auth-brand-orb"><img src={identity.icon} alt={identity.schoolName} /></div>
          <div className="auth-brand-copy"><span className="auth-kicker">منصة رقمية متكاملة</span><h1>{identity.schoolName}</h1><p>{identity.teacherName}</p><small>{identity.teacherTitle}</small></div>
          <div className="auth-brand-notes"><div><BadgeInfo size={16} /><span>حسابات منفصلة وصلاحيات محددة</span></div><div><ScanLine size={16} /><span>QR للتعريف فقط وPIN لإثبات الهوية</span></div></div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-topline">
            <div><span className="eyebrow">تسجيل الدخول الآمن</span><h2>اختر الدور الذي تريد الدخول به</h2><p>لا يكفي كود الطالب أو رقم الهاتف وحده؛ كل حساب يحتاج PIN مستقلًا.</p></div>
            <div className="auth-role-pill"><KeyRound size={16} /><span>{selectedLabel}</span></div>
          </div>

          <div className="auth-role-grid">
            {roles.map(({ key, title, hint, icon: Icon }) => (
              <button key={key} className={`auth-role-card ${role === key ? 'active' : ''}`} onClick={() => setRole(key)} type="button"><span><Icon size={18} /></span><strong>{title}</strong><small>{hint}</small></button>
            ))}
          </div>

          <div className="auth-fields-area">
            {STAFF_ROLES.has(role) && !forgotOpen && (
              <>
                {!staffConfigured && <div className="auth-notice success">هذه أول مرة لهذا الدور. أنشئ PIN قويًا الآن، ولن تُحفظ الأرقام الافتراضية داخل الكود.</div>}
                {pinField(staffConfigured ? `PIN ${roleInfo.title}` : 'إنشاء PIN جديد')}
                {!staffConfigured && <label className="auth-field"><span>تأكيد PIN</span><input type="password" inputMode="numeric" maxLength={10} value={confirmPin} onChange={(event) => setConfirmPin(normalizePin(event.target.value))} placeholder="أعد كتابة PIN" /></label>}
                <div className="auth-remember-row">
                  <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>تذكرني لمدة 7 أيام</span></label>
                  {staffConfigured && data.settings.staffRecoveryAnswerHash && <button type="button" className="auth-link-btn" onClick={() => setForgotOpen(true)}>نسيت PIN؟</button>}
                </div>
                <button className="auth-submit" onClick={handleUnlock} disabled={loading} type="button"><ArrowRight size={17} /> {staffConfigured ? `دخول ${roleInfo.title}` : 'تفعيل الحساب والدخول'}</button>
              </>
            )}

            {STAFF_ROLES.has(role) && forgotOpen && (
              <div className="auth-recovery">
                <div className="auth-recovery-head"><span><HelpCircle size={16} /> استرجاع PIN</span><button type="button" className="auth-icon-btn" onClick={closeRecovery} aria-label="إغلاق"><X size={16} /></button></div>
                {recoverySuccess ? (
                  <><div className="auth-notice success"><Check size={16} /> تم تحديث PIN بنجاح.</div><button className="auth-submit" type="button" onClick={closeRecovery}><ArrowRight size={17} /> العودة للدخول</button></>
                ) : (
                  <>
                    <p className="auth-recovery-question">أدخل عبارة الاسترجاع الخاصة التي تم ضبطها من الإعدادات.</p>
                    <label className="auth-field"><span>عبارة الاسترجاع</span><input type="password" value={recoveryAnswer} onChange={(event) => setRecoveryAnswer(event.target.value)} autoComplete="off" /></label>
                    <label className="auth-field"><span>PIN جديد</span><input type="password" inputMode="numeric" maxLength={10} value={recoveryNewPin} onChange={(event) => setRecoveryNewPin(normalizePin(event.target.value))} placeholder="6 إلى 10 أرقام" /></label>
                    <label className="auth-field"><span>تأكيد PIN</span><input type="password" inputMode="numeric" maxLength={10} value={recoveryConfirmPin} onChange={(event) => setRecoveryConfirmPin(normalizePin(event.target.value))} /></label>
                    {recoveryNotice && <div className="auth-notice error">{recoveryNotice}</div>}
                    <button className="auth-submit" type="button" onClick={submitRecovery} disabled={recoveryLoading}><ArrowRight size={17} /> تحديث PIN</button>
                  </>
                )}
              </div>
            )}

            {role === 'student' && (
              <>
                <label className="auth-field"><span>كود الطالب أو QR</span><input inputMode="numeric" placeholder="ادخل الكود أو امسحه بالكاميرا" value={identifier} onChange={(event) => setIdentifier(normalizeDigits(event.target.value).slice(0, 10))} /></label>
                {pinField('PIN الطالب')}
                <div className="auth-inline-actions">
                  <button className="auth-submit secondary" onClick={handleUnlock} disabled={loading} type="button"><ArrowRight size={17} /> دخول الطالب</button>
                  <button className="auth-submit ghost" onClick={() => setCameraOpen((value) => !value)} type="button"><Camera size={17} /> {cameraOpen ? 'إغلاق الكاميرا' : 'مسح QR'}</button>
                </div>
                {cameraOpen && <div className="qr-scanner-box"><video ref={videoRef} playsInline muted autoPlay /><div className="qr-scanner-frame" /><small>{scanMessage || 'وجّه الكاميرا إلى QR، ثم أدخل PIN.'}</small></div>}
              </>
            )}

            {role === 'guardian' && (
              <>
                <label className="auth-field"><span>رقم الهاتف المسجل</span><input inputMode="numeric" placeholder="رقم ولي الأمر المسجل عند المعلم" value={identifier} onChange={(event) => setIdentifier(normalizeDigits(event.target.value).slice(0, 15))} /></label>
                {pinField('PIN ولي الأمر')}
                <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>تذكرني لمدة 7 أيام</span></label>
                <button className="auth-submit" onClick={handleUnlock} disabled={loading} type="button"><ArrowRight size={17} /> دخول ولي الأمر</button>
              </>
            )}

            {role === 'visitor' && (
              <><label className="auth-field"><span>اسم الزائر</span><input placeholder="اكتب الاسم أو اتركه فارغًا" value={visitorName} onChange={(event) => setVisitorName(event.target.value.slice(0, 80))} onKeyDown={(event) => event.key === 'Enter' && handleUnlock()} /></label><button className="auth-submit" onClick={handleUnlock} disabled={loading} type="button"><ArrowRight size={17} /> دخول محدود</button></>
            )}

            {notice && !forgotOpen && <div className="auth-notice error">{notice}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
