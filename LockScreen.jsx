import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, KeyRound, QrCode, UsersRound, ShieldCheck, UserRound, PersonStanding, ScanLine, ArrowRight, BadgeInfo } from 'lucide-react';
import { identity } from '../config/identity';
import { verifyPinSecret } from '../utils/security';
import { defaultAuthState, normalizeDigits, resolveGuardianByPhone, resolveStudentByCode, resolveStudentFromQrPayload, ROLE_LABELS } from '../utils/auth';

const roles = [
  { key: 'admin', title: 'الإدارة', hint: 'الرقم السري', icon: ShieldCheck },
  { key: 'student', title: 'الطالب', hint: 'الكود أو QR', icon: UserRound },
  { key: 'guardian', title: 'ولي الأمر', hint: 'الرقم المسجل أو كود الطالب', icon: UsersRound },
  { key: 'visitor', title: 'الزائر', hint: 'دخول سريع', icon: PersonStanding },
];

function cleanQrPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload.trim();
  return String(payload).trim();
}

export default function LockScreen({ data, onUnlock }) {
  const [role, setRole] = useState('admin');
  const [pin, setPin] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);

  const roleInfo = useMemo(() => roles.find((item) => item.key === role) || roles[0], [role]);
  const selectedLabel = ROLE_LABELS[role] || 'المستخدم';

  useEffect(() => {
    setPin('');
    setIdentifier('');
    setVisitorName('');
    setNotice('');
    setScanMessage('');
    setCameraOpen(false);
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
      if (selectedRole === 'admin') {
        const ok = await verifyPinSecret(pin, data.settings);
        if (!ok) throw new Error('الرقم السري غير صحيح');
        onUnlock(defaultAuthState('admin'));
        return;
      }

      if (selectedRole === 'student') {
        const code = rawIdentifier || identifier;
        const studentRecord = student || resolveStudentByCode(data, code) || resolveStudentFromQrPayload(data, code);
        if (!studentRecord) throw new Error('لم يتم العثور على الطالب بهذا الكود');
        onUnlock(defaultAuthState('student', studentRecord));
        return;
      }

      if (selectedRole === 'guardian') {
        const studentRecord = resolveGuardianByPhone(data, identifier) || resolveStudentByCode(data, identifier);
        if (!studentRecord) throw new Error('لم يتم العثور على ولي الأمر أو الطالب المرتبط بهذا الرقم');
        onUnlock(defaultAuthState('guardian', studentRecord));
        return;
      }

      const trimmed = visitorName.trim();
      onUnlock({ ...defaultAuthState('visitor'), displayName: trimmed || 'زائر' });
    } catch (error) {
      setNotice(error?.message || 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const primaryAction = () => handleUnlock();

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
            <div><BadgeInfo size={16} /><span>إدارة • طالب • ولي أمر • زائر</span></div>
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
            {role === 'admin' && (
              <>
                <label className="auth-field">
                  <span>الرقم السري للإدارة</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••••"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(normalizeDigits(e.target.value).slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && primaryAction()}
                  />
                </label>
                <button className="auth-submit" onClick={primaryAction} disabled={loading} type="button">
                  <ArrowRight size={17} /> دخول الإدارة
                </button>
              </>
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

            {role === 'guardian' && (
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
                <button className="auth-submit" onClick={primaryAction} disabled={loading} type="button">
                  <ArrowRight size={17} /> دخول ولي الأمر
                </button>
              </>
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

            {notice && <div className="auth-notice error">{notice}</div>}
            {role === 'admin' && data?.settings?.adminPinHash ? <small className="auth-help">تم تفعيل PIN آمن بالإدارة.</small> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
