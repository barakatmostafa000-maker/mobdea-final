import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, KeyRound, UsersRound, ShieldCheck, UserRound, PersonStanding, ScanLine,
  ArrowRight, BadgeInfo, GraduationCap, Eye, EyeOff, HelpCircle, UserPlus, Check, X,
} from 'lucide-react';
import { identity } from '../config/identity';
import { verifyPinSecret, createPinSecret, verifyRecoverySecret } from '../utils/security';
import {
  defaultAuthState, normalizeDigits, resolveGuardianByPhone, resolveStudentByCode,
  resolveStudentFromQrPayload, registerGuardianAccount, ROLE_LABELS,
} from '../utils/auth';

const roles = [
  { key: 'teacher', title: 'المعلم', hint: 'الرقم السري', icon: GraduationCap, pinPrefix: 'teacher' },
  { key: 'admin', title: 'الإدارة', hint: 'الرقم السري', icon: ShieldCheck, pinPrefix: 'admin' },
  { key: 'student', title: 'الطالب', hint: 'الكود أو QR', icon: UserRound },
  { key: 'guardian', title: 'ولي الأمر', hint: 'الرقم المسجل أو كود الطالب', icon: UsersRound },
  { key: 'visitor', title: 'الزائر', hint: 'دخول سريع', icon: PersonStanding },
];

const PIN_ROLES = new Set(['teacher', 'admin']);

function cleanQrPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload.trim();
  return String(payload).trim();
}

export default function LockScreen({ data, onUnlock, updateData }) {
  const [role, setRole] = useState('teacher');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  // Forgot-password (recovery) flow for teacher/admin PIN roles.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // Create-account (self-registration) flow for guardians.
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerCode, setRegisterCode] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerNotice, setRegisterNotice] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);

  const roleInfo = useMemo(() => roles.find((item) => item.key === role) || roles[0], [role]);
  const selectedLabel = ROLE_LABELS[role] || 'المستخدم';

  useEffect(() => {
    setPin('');
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
    setRegisterOpen(false);
    setRegisterCode('');
    setRegisterPhone('');
    setRegisterNotice('');
  }, [role]);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
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
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if ('BarcodeDetector' in window) {
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
          scanTimerRef.current = window.setInterval(async () => {
            if (!videoRef.current || !detectorRef.current) return;
            try {
              const codes = await detectorRef.current.detect(videoRef.current);
              const value = cleanQrPayload(codes?.[0]?.rawValue);
              if (!value) return;
              const student = resolveStudentFromQrPayload(data, value);
              if (student) {
                setScanMessage(`تم العثور على الطالب: ${student.name}`);
                handleUnlock('student', student, student.code?.toString() || value);
              } else {
                setScanMessage('تم قراءة QR لكن لم يتم العثور على الطالب المرتبط به.');
              }
            } catch {
              // silent scan loop
            }
          }, 1100);
        } else {
          setScanMessage('مسح QR تلقائيًا غير مدعوم في هذا المتصفح؛ استخدم إدخال الكود يدويًا.');
        }
      } catch (error) {
        setScanMessage(error?.message || 'تعذر فتح الكاميرا.');
      }
    };

    openCamera();
    return () => {
      cancelled = true;
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      detectorRef.current = null;
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  const handleUnlock = async (selectedRole = role, student = null, rawIdentifier = '') => {
    setLoading(true);
    setNotice('');
    try {
      if (selectedRole === 'teacher' || selectedRole === 'admin') {
        const prefix = selectedRole === 'teacher' ? 'teacher' : 'admin';
        const ok = await verifyPinSecret(pin, data.settings, prefix);
        if (!ok) throw new Error('الرقم السري غير صحيح');
        onUnlock(defaultAuthState(selectedRole), { remember });
        return;
      }

      if (selectedRole === 'student') {
        const code = rawIdentifier || identifier;
        const studentRecord = student || resolveStudentByCode(data, code) || resolveStudentFromQrPayload(data, code);
        if (!studentRecord) throw new Error('لم يتم العثور على الطالب بهذا الكود');
        onUnlock(defaultAuthState('student', studentRecord), { remember });
        return;
      }

      if (selectedRole === 'guardian') {
        const studentRecord = resolveGuardianByPhone(data, identifier) || resolveStudentByCode(data, identifier);
        if (!studentRecord) throw new Error('لم يتم العثور على ولي الأمر أو الطالب المرتبط بهذا الرقم');
        onUnlock(defaultAuthState('guardian', studentRecord), { remember });
        return;
      }

      const trimmed = visitorName.trim();
      onUnlock({ ...defaultAuthState('visitor'), displayName: trimmed || 'زائر' }, { remember: false });
    } catch (error) {
      setNotice(error?.message || 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const primaryAction = () => handleUnlock();

  const submitRecovery = async () => {
    setRecoveryNotice('');
    const question = String(data?.settings?.staffRecoveryQuestion || '').trim();
    if (!question) {
      setRecoveryNotice('لم يتم إعداد سؤال استرجاع بعد. يمكن ضبطه من الإعدادات بعد الدخول.');
      return;
    }
    const newPinDigits = normalizeDigits(recoveryNewPin);
    if (newPinDigits.length < 4) {
      setRecoveryNotice('اكتب رقمًا سريًا جديدًا من 4 أرقام على الأقل');
      return;
    }
    if (newPinDigits !== normalizeDigits(recoveryConfirmPin)) {
      setRecoveryNotice('الرقمان غير متطابقين');
      return;
    }
    setRecoveryLoading(true);
    try {
      const ok = await verifyRecoverySecret(recoveryAnswer, data.settings);
      if (!ok) throw new Error('الإجابة غير صحيحة');
      const prefix = role === 'teacher' ? 'teacher' : 'admin';
      const secret = await createPinSecret(newPinDigits, prefix);
      await updateData({
        ...data,
        settings: {
          ...data.settings,
          ...secret,
          [`${prefix}Pin`]: '',
        },
      });
      setRecoverySuccess(true);
      setRecoveryNotice('');
    } catch (error) {
      setRecoveryNotice(error?.message || 'تعذر استرجاع الحساب');
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

  const submitRegister = async () => {
    setRegisterNotice('');
    setRegisterLoading(true);
    try {
      const result = registerGuardianAccount(data, registerCode, registerPhone);
      await updateData(result.data);
      onUnlock(defaultAuthState('guardian', result.student), { remember });
    } catch (error) {
      setRegisterNotice(error?.message || 'تعذر إنشاء الحساب');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-background">
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
        <div className="auth-glow auth-glow-3" />
      </div>

      <section className="auth-card">
        <aside className="auth-brand-panel">
          <div className="auth-brand-orb">
            <img src={identity.icon} alt={identity.schoolName} />
          </div>
          <div className="auth-brand-copy">
            <span className="auth-kicker">منصة رقمية متكاملة</span>
            <h1>{identity.schoolName}</h1>
            <p>{identity.teacherName}</p>
            <small>{identity.teacherTitle}</small>
          </div>
          <div className="auth-brand-notes">
            <div><BadgeInfo size={16} /><span>معلم • إدارة • طالب • ولي أمر • زائر</span></div>
            <div><ScanLine size={16} /><span>QR • كود الطالب • الرقم المسجل</span></div>
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-topline">
            <div>
              <span className="eyebrow">تسجيل الدخول</span>
              <h2>اختر الدور الذي تريد الدخول به</h2>
              <p>تحكم كامل في ما يظهر لكل مستخدم، مع الحفاظ على كل الصلاحيات الخاصة بكل دور.</p>
            </div>
            <div className="auth-role-pill">
              <KeyRound size={16} />
              <span>{selectedLabel}</span>
            </div>
          </div>

          <div className="auth-role-grid">
            {roles.map(({ key, title, hint, icon: Icon }) => (
              <button key={key} className={`auth-role-card ${role === key ? 'active' : ''}`} onClick={() => setRole(key)} type="button">
                <span><Icon size={18} /></span>
                <strong>{title}</strong>
                <small>{hint}</small>
              </button>
            ))}
          </div>

          <div className="auth-panel-shell">
            {PIN_ROLES.has(role) && !forgotOpen && (
              <>
                <label className="auth-field">
                  <span>الرقم السري لـ{roleInfo.title}</span>
                  <div className="auth-pin-wrap">
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      placeholder="••••••"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(normalizeDigits(e.target.value).slice(0, 6))}
                      onKeyDown={(e) => e.key === 'Enter' && primaryAction()}
                    />
                    <button type="button" className="auth-pin-eye" onClick={() => setShowPin((v) => !v)} aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}>
                      {showPin ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <div className="auth-remember-row">
                  <label className="auth-remember">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span>تذكرني</span>
                  </label>
                  <button type="button" className="auth-link-btn" onClick={() => setForgotOpen(true)}>
                    نسيت كلمة المرور؟
                  </button>
                </div>

                <button className="auth-submit" onClick={primaryAction} disabled={loading} type="button">
                  <ArrowRight size={17} /> دخول {roleInfo.title}
                </button>
              </>
            )}

            {PIN_ROLES.has(role) && forgotOpen && (
              <div className="auth-recovery">
                <div className="auth-recovery-head">
                  <span><HelpCircle size={16} /> استرجاع الرقم السري</span>
                  <button type="button" className="auth-icon-btn" onClick={closeRecovery} aria-label="إغلاق"><X size={16} /></button>
                </div>

                {recoverySuccess ? (
                  <>
                    <div className="auth-notice success"><Check size={16} /> تم تحديث الرقم السري بنجاح، يمكنك الآن تسجيل الدخول به.</div>
                    <button className="auth-submit" type="button" onClick={closeRecovery}>
                      <ArrowRight size={17} /> العودة لتسجيل الدخول
                    </button>
                  </>
                ) : data?.settings?.staffRecoveryQuestion ? (
                  <>
                    <p className="auth-recovery-question">{data.settings.staffRecoveryQuestion}</p>
                    <label className="auth-field">
                      <span>الإجابة</span>
                      <input value={recoveryAnswer} onChange={(e) => setRecoveryAnswer(e.target.value)} placeholder="اكتب إجابتك" />
                    </label>
                    <label className="auth-field">
                      <span>رقم سري جديد</span>
                      <input inputMode="numeric" maxLength={6} value={recoveryNewPin} onChange={(e) => setRecoveryNewPin(normalizeDigits(e.target.value).slice(0, 6))} placeholder="4 أرقام على الأقل" />
                    </label>
                    <label className="auth-field">
                      <span>تأكيد الرقم السري</span>
                      <input inputMode="numeric" maxLength={6} value={recoveryConfirmPin} onChange={(e) => setRecoveryConfirmPin(normalizeDigits(e.target.value).slice(0, 6))} placeholder="أعد كتابة الرقم" />
                    </label>
                    {recoveryNotice && <div className="auth-notice error">{recoveryNotice}</div>}
                    <button className="auth-submit" type="button" onClick={submitRecovery} disabled={recoveryLoading}>
                      <ArrowRight size={17} /> تحديث الرقم السري
                    </button>
                  </>
                ) : (
                  <div className="auth-notice error">لم يتم إعداد سؤال استرجاع بعد. سجّل الدخول بالرقم الحالي ثم فعّله من الإعدادات.</div>
                )}
              </div>
            )}

            {role === 'student' && (
              <>
                <label className="auth-field">
                  <span>كود الطالب أو QR</span>
                  <input
                    inputMode="numeric"
                    placeholder="ادخل الكود أو امسحه بالكاميرا"
                    value={identifier}
                    onChange={(e) => setIdentifier(normalizeDigits(e.target.value).slice(0, 10))}
                    onKeyDown={(e) => e.key === 'Enter' && primaryAction()}
                  />
                </label>
                <div className="auth-inline-actions">
                  <button className="auth-submit secondary" onClick={primaryAction} disabled={loading} type="button">
                    <ArrowRight size={17} /> دخول الطالب
                  </button>
                  <button className="auth-submit ghost" onClick={() => setCameraOpen((value) => !value)} type="button">
                    <Camera size={17} /> {cameraOpen ? 'إغلاق الكاميرا' : 'مسح QR'}
                  </button>
                </div>
                {cameraOpen && (
                  <div className="qr-scanner-box">
                    <video ref={videoRef} playsInline muted autoPlay />
                    <div className="qr-scanner-frame" />
                    <small>{scanMessage || 'وجّه الكاميرا إلى QR الموجود على كارت الطالب.'}</small>
                  </div>
                )}
              </>
            )}

            {role === 'guardian' && !registerOpen && (
              <>
                <label className="auth-field">
                  <span>الرقم المسجل أو كود الطالب</span>
                  <input
                    inputMode="numeric"
                    placeholder="رقم ولي الأمر أو كود الطالب"
                    value={identifier}
                    onChange={(e) => setIdentifier(normalizeDigits(e.target.value).slice(0, 15))}
                    onKeyDown={(e) => e.key === 'Enter' && primaryAction()}
                  />
                </label>
                <div className="auth-remember-row">
                  <label className="auth-remember">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span>تذكرني</span>
                  </label>
                  <button type="button" className="auth-link-btn" onClick={() => setRegisterOpen(true)}>
                    <UserPlus size={14} /> إنشاء حساب لأول مرة
                  </button>
                </div>
                <button className="auth-submit" onClick={primaryAction} disabled={loading} type="button">
                  <ArrowRight size={17} /> دخول ولي الأمر
                </button>
              </>
            )}

            {role === 'guardian' && registerOpen && (
              <div className="auth-recovery">
                <div className="auth-recovery-head">
                  <span><UserPlus size={16} /> ربط حساب ولي الأمر بالطالب</span>
                  <button type="button" className="auth-icon-btn" onClick={() => setRegisterOpen(false)} aria-label="إغلاق"><X size={16} /></button>
                </div>
                <label className="auth-field">
                  <span>كود الطالب</span>
                  <input inputMode="numeric" value={registerCode} onChange={(e) => setRegisterCode(normalizeDigits(e.target.value).slice(0, 10))} placeholder="كود الطالب الذي يعطيه المعلم" />
                </label>
                <label className="auth-field">
                  <span>رقم هاتفك</span>
                  <input inputMode="numeric" value={registerPhone} onChange={(e) => setRegisterPhone(normalizeDigits(e.target.value).slice(0, 15))} placeholder="سيتم استخدامه لتسجيل الدخول لاحقًا" />
                </label>
                {registerNotice && <div className="auth-notice error">{registerNotice}</div>}
                <button className="auth-submit" type="button" onClick={submitRegister} disabled={registerLoading}>
                  <ArrowRight size={17} /> إنشاء الحساب والدخول
                </button>
              </div>
            )}

            {role === 'visitor' && (
              <>
                <label className="auth-field">
                  <span>اسم الزائر</span>
                  <input
                    placeholder="اكتب الاسم أو اتركه فارغًا"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && primaryAction()}
                  />
                </label>
                <button className="auth-submit" onClick={primaryAction} disabled={loading} type="button">
                  <ArrowRight size={17} /> دخول الزائر
                </button>
              </>
            )}

            {notice && !forgotOpen && <div className="auth-notice error">{notice}</div>}
            {role === 'admin' && !forgotOpen && data?.settings?.adminPinHash ? <small className="auth-help">تم تفعيل PIN آمن بالإدارة.</small> : null}
            {role === 'teacher' && !forgotOpen && data?.settings?.teacherPinHash ? <small className="auth-help">تم تفعيل PIN آمن بالمعلم.</small> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
