// PROJECT13_BARCODE_ATTENDANCE_ACCOUNTING_V1
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, CreditCard, ScanLine, WalletCards, X } from 'lucide-react';
import { queueAbsenceNotification, sendAbsenceWhatsApp } from '../services/notifications';
import { todayISO } from '../utils/time';
import {
  findSessionPayment,
  registerBarcodeAttendance,
  sessionPriceFor,
} from '../services/project13AttendanceAccounting';
import {
  resolveStudentFromBarcode,
  scanStudentBarcodeNative,
} from '../services/project13BarcodeScanner';

const statuses = ['present', 'late', 'absent', 'excused'];
const labels = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'غياب بعذر' };

export default function Attendance({ data, updateData }) {
  const current = data.sessions.find((item) => item.current) || data.sessions[0];
  const students = current ? data.students.filter((student) => !current.group || student.group === current.group) : [];
  const today = todayISO();
  const [notice, setNotice] = useState('');
  const [scanStudent, setScanStudent] = useState(null);
  const [browserScanOpen, setBrowserScanOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const timerRef = useRef(null);

  const attendanceMap = useMemo(() => Object.fromEntries(
    (data.attendance || [])
      .filter((item) => item.date === today && String(item.sessionId) === String(current?.id))
      .map((item) => [String(item.studentId), item]),
  ), [current?.id, data.attendance, today]);

  const stopBrowserScanner = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setBrowserScanOpen(false);
  };

  useEffect(() => () => stopBrowserScanner(), []);

  const chooseScannedStudent = (rawValue) => {
    const found = resolveStudentFromBarcode(data, rawValue);
    if (!found || (current?.group && found.group !== current.group)) {
      setNotice('تمت قراءة الباركود لكن الطالب غير موجود في الحصة الحالية.');
      return false;
    }
    setScanStudent(found);
    setNotice(`تمت قراءة باركود ${found.name}. حدّد هل الحصة مدفوعة أم مستحقة.`);
    stopBrowserScanner();
    return true;
  };

  const startBrowserScanner = async () => {
    setScannerError('');
    setBrowserScanOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) {
        throw new Error('قارئ الباركود غير مدعوم في هذا المتصفح؛ استخدم APK على الجهاز.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39'] });
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !detectorRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          const raw = codes?.[0]?.rawValue || '';
          if (raw) chooseScannedStudent(raw);
        } catch {
          // Continue scanning.
        }
      }, 650);
    } catch (error) {
      setScannerError(error?.message || 'تعذر تشغيل الكاميرا.');
    }
  };

  const startScan = async () => {
    if (!current) return;
    setNotice('');
    setScannerError('');
    const native = await scanStudentBarcodeNative();
    if (native.supported) {
      if (native.cancelled) return;
      if (native.rawValue) {
        chooseScannedStudent(native.rawValue);
        return;
      }
      if (native.error) setNotice(`${native.error} — سيتم فتح قارئ الكاميرا داخل الصفحة.`);
    }
    await startBrowserScanner();
  };

  const confirmBarcodeAttendance = async (paymentStatus) => {
    if (!scanStudent || !current) return;
    const next = registerBarcodeAttendance(data, {
      student: scanStudent,
      session: current,
      date: today,
      paymentStatus,
      attendanceStatus: 'present',
    });
    await updateData(next);
    setNotice(
      `تم تسجيل ${scanStudent.name} حاضر — ${
        paymentStatus === 'paid' ? 'الحصة مدفوعة' : 'الحصة مستحقة'
      } — ${sessionPriceFor(scanStudent, current)} ج.`,
    );
    setScanStudent(null);
  };

  const mark = async (student, status) => {
    const old = (data.attendance || []).find((item) =>
      String(item.studentId) === String(student.id)
      && item.date === today
      && String(item.sessionId) === String(current?.id)
    );
    const attendance = old
      ? data.attendance.map((item) => item.id === old.id ? { ...item, status, updatedAt: new Date().toISOString() } : item)
      : [...data.attendance, {
          id: Date.now() + Math.random(),
          studentId: student.id,
          status,
          date: today,
          sessionId: current?.id || null,
          sessionTitle: current?.title || '',
          source: 'manual',
          updatedAt: new Date().toISOString(),
        }];
    let next = { ...data, attendance };
    if (status === 'absent') next = queueAbsenceNotification(next, student, current, today);
    await updateData(next);
  };

  const updatePayment = async (student, paymentStatus) => {
    if (!current) return;
    const next = registerBarcodeAttendance(data, {
      student,
      session: current,
      date: today,
      paymentStatus,
      attendanceStatus: attendanceMap[String(student.id)]?.status || 'present',
    });
    await updateData(next);
    setNotice(`${student.name}: ${paymentStatus === 'paid' ? 'تم تسجيل الحصة مدفوعة.' : 'تم تسجيل الحصة مستحقة.'}`);
  };

  if (!current) return <section className="page"><div className="panel empty-state">لا توجد حصة حالية.</div></section>;

  const counts = statuses.reduce((acc, status) => {
    acc[status] = Object.values(attendanceMap).filter((item) => item.status === status).length;
    return acc;
  }, {});

  return (
    <section className="page project13-attendance-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الحصة الحالية</span>
          <h2>حضور بالباركود + حساب الحصة</h2>
          <p>{current.title} — {current.group}. قراءة الكود تسجل الحضور وتربط المدفوع/المستحق بالحسابات فورًا.</p>
        </div>
        <button className="primary-btn project13-scan-attendance" type="button" onClick={() => void startScan()}>
          <ScanLine size={19}/> مسح باركود الطالب
        </button>
      </div>

      {notice && <div className="settings-notice success">{notice}</div>}

      <div className="stats-grid compact">
        <div className="stat-card"><div><span>حاضر</span><strong>{counts.present}</strong><small>من {students.length}</small></div></div>
        <div className="stat-card"><div><span>متأخر</span><strong>{counts.late}</strong><small>يحتاج متابعة</small></div></div>
        <div className="stat-card"><div><span>غائب</span><strong>{counts.absent}</strong><small>يجهز تنبيه ولي الأمر</small></div></div>
        <div className="stat-card"><div><span>بعذر</span><strong>{counts.excused}</strong><small>غياب بعذر</small></div></div>
      </div>

      <div className="attendance-list">
        {students.map((student) => {
          const attendance = attendanceMap[String(student.id)];
          const payment = findSessionPayment(data, student.id, current.id, today);
          const paymentStatus = attendance?.paymentStatus || payment?.type || '';
          return (
            <article className="panel attendance-row project13-attendance-row" key={student.id}>
              <div>
                <span className="student-code">{student.code}</span>
                <strong>{student.name}</strong>
                <small>{student.grade} • {sessionPriceFor(student, current)} ج</small>
              </div>

              <div className="attendance-actions">
                {statuses.map((status) => (
                  <button key={status} className={attendance?.status === status ? `active ${status}` : status} type="button" onClick={() => void mark(student, status)}>
                    {labels[status]}
                  </button>
                ))}
              </div>

              <div className="project13-payment-actions">
                <button type="button" className={paymentStatus === 'paid' ? 'paid active' : 'paid'} onClick={() => void updatePayment(student, 'paid')}>
                  <CheckCircle2 size={14}/> مدفوع
                </button>
                <button type="button" className={paymentStatus === 'due' ? 'due active' : 'due'} onClick={() => void updatePayment(student, 'due')}>
                  <WalletCards size={14}/> مستحق
                </button>
              </div>

              <div className="attendance-notify-cell">
                {attendance?.status === 'absent' && (
                  <button className="secondary-btn attendance-whatsapp-btn" type="button" onClick={async () => {
                    const result = await sendAbsenceWhatsApp(student, current, today);
                    setNotice(result.message);
                  }}>إبلاغ ولي الأمر</button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {scanStudent && (
        <div className="modal-backdrop">
          <div className="modal-card project13-payment-decision">
            <CreditCard size={32}/>
            <span className="eyebrow">تم تسجيل الباركود</span>
            <h3>{scanStudent.name}</h3>
            <p>قيمة الحصة: <b>{sessionPriceFor(scanStudent, current)} ج</b>. هل تم دفع الحصة؟</p>
            <div className="project13-payment-decision-actions">
              <button className="primary-btn" type="button" onClick={() => void confirmBarcodeAttendance('paid')}>حاضر + مدفوع</button>
              <button className="secondary-btn" type="button" onClick={() => void confirmBarcodeAttendance('due')}>حاضر + مستحق</button>
              <button className="text-btn" type="button" onClick={() => setScanStudent(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {browserScanOpen && (
        <div className="modal-backdrop">
          <div className="modal-card scanner-modal">
            <div className="panel-title"><h3><Camera size={18}/> قارئ الباركود</h3><button className="text-btn" type="button" onClick={stopBrowserScanner}><X size={18}/> إغلاق</button></div>
            <video ref={videoRef} className="scanner-video" muted playsInline/>
            <p className="settings-help">وجّه الكاميرا نحو QR أو Barcode الموجود على كارت الطالب.</p>
            {scannerError && <div className="settings-notice">{scannerError}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
