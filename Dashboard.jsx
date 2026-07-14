import {
  ArrowLeft, Bell, BookOpenCheck, CalendarClock, CheckCircle2, Gamepad2,
  MessageCircle, Presentation, QrCode, ScanLine, Sparkles, Trophy, UserPlus,
  Users, WalletCards
} from 'lucide-react';
import { formatTime12 } from '../utils/time';

function ActionButton({ icon: Icon, title, hint, onClick, tone = '' }) {
  return (
    <button className={`dashboard-action ${tone}`} onClick={onClick}>
      <span><Icon size={21} /></span>
      <div><strong>{title}</strong><small>{hint}</small></div>
      <ArrowLeft size={16} />
    </button>
  );
}

export default function Dashboard({ data, navigate }) {
  const currentSession = data.sessions.find((session) => session.current);
  const students = currentSession ? data.students.filter((student) => student.group === currentSession.group) : [];
  const today = new Date().toISOString().slice(0, 10);
  const attendance = data.attendance.filter((item) => item.date === today && students.some((student) => student.id === item.studentId));
  const present = attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
  const absent = attendance.filter((item) => item.status === 'absent').length;
  const readyNotifications = (data.notifications || []).filter((item) => item.status === 'ready').length;
  const due = data.payments.filter((item) => item.type === 'due' && students.some((student) => student.id === item.studentId)).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const ranked = students.map((student) => {
    const grades = data.grades.filter((grade) => grade.studentId === student.id);
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + (grade.score / grade.total) * 100, 0) / grades.length) : 0;
    return { ...student, average };
  }).sort((a, b) => b.average - a.average).slice(0, 4);

  return (
    <section className="page dashboard-page">
      <article className="dashboard-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> منصة المُبدع لتعليم ممتع</div>
          <h2>أهلاً أستاذ مصطفى، خلّي حصة اليوم مختلفة.</h2>
          <p>ابدأ الحصة، سجّل الحضور، افتح الشرح، وشغّل التفاعل من مكان واحد.</p>
          <div className="hero-actions">
            <button className="hero-primary" onClick={() => navigate('classMode')}><Presentation size={20} /> بدء وضع الحصة</button>
            <button className="hero-secondary" onClick={() => navigate('sessions')}><CalendarClock size={19} /> إدارة الجدول</button>
          </div>
        </div>
        <div className="hero-session-card">
          <span className="live-badge">● الحصة الحالية</span>
          <h3>{currentSession?.title || 'لم يتم تحديد حصة'}</h3>
          <p>{currentSession ? `${currentSession.group} • ${currentSession.day} • ${formatTime12(currentSession.time)}` : 'حدد الحصة الحالية من قسم الحصص والمجموعات'}</p>
          <div className="hero-session-metrics">
            <div><strong>{students.length}</strong><span>طالب</span></div>
            <div><strong>{present}</strong><span>حاضر</span></div>
            <div><strong>{absent}</strong><span>غائب</span></div>
          </div>
        </div>
      </article>

      <div className="dashboard-summary-strip">
        <div><Users size={21} /><span><small>طلاب المجموعة</small><strong>{students.length}</strong></span></div>
        <div><CheckCircle2 size={21} /><span><small>الحضور المسجل</small><strong>{present}/{students.length}</strong></span></div>
        <div><MessageCircle size={21} /><span><small>رسائل جاهزة</small><strong>{readyNotifications}</strong></span></div>
        <div><WalletCards size={21} /><span><small>مستحقات المجموعة</small><strong>{due} ج</strong></span></div>
      </div>

      <div className="dashboard-section-heading">
        <div><span className="eyebrow">وصول سريع</span><h3>الإجراءات السريعة</h3></div>
        <small>كل الأدوات الأساسية على بُعد ضغطة</small>
      </div>

      <div className="dashboard-actions-grid">
        <ActionButton icon={Presentation} title="بدء الحصة" hint="الحضور والشرح والتفاعل" tone="gold" onClick={() => navigate('classMode')} />
        <ActionButton icon={QrCode} title="الحضور السريع" hint="يدوي أو باستخدام الكود" onClick={() => navigate('attendance')} />
        <ActionButton icon={ScanLine} title="رصد الدرجات" hint="سؤالًا بسؤال بالكود" onClick={() => navigate('gradeScanner')} />
        <ActionButton icon={BookOpenCheck} title="الدرجات" hint="النتائج والترتيب" onClick={() => navigate('grades')} />
        <ActionButton icon={Gamepad2} title="الألعاب" hint="جولات وتحديات" onClick={() => navigate('games')} />
        <ActionButton icon={UserPlus} title="إضافة طالب" hint="البيانات والمجموعة" onClick={() => navigate('students')} />
      </div>

      <div className="dashboard-content-grid">
        <article className="panel premium-panel">
          <div className="panel-title">
            <div><span className="eyebrow">الحصة الحالية</span><h3>طلاب المجموعة</h3></div>
            <button onClick={() => navigate('students')}>عرض الكل</button>
          </div>
          <div className="dashboard-student-list">
            {students.length ? students.slice(0, 6).map((student) => {
              const status = attendance.find((item) => item.studentId === student.id)?.status;
              return (
                <button key={student.id} className="dashboard-student-row" onClick={() => navigate('classMode')}>
                  <span className="student-code">{student.code}</span>
                  <span><strong>{student.name}</strong><small>{student.grade}</small></span>
                  <b className={`attendance-dot ${status || 'pending'}`}>{status === 'present' ? 'حاضر' : status === 'late' ? 'متأخر' : status === 'absent' ? 'غائب' : 'لم يسجل'}</b>
                </button>
              );
            }) : <div className="empty-state">لا يوجد طلاب في المجموعة الحالية.</div>}
          </div>
        </article>

        <article className="panel premium-panel ranking-panel">
          <div className="panel-title">
            <div><span className="eyebrow">لوحة التميز</span><h3>متفوقو المجموعة</h3></div>
            <Trophy size={22} />
          </div>
          <div className="ranking-list">
            {ranked.length ? ranked.map((student, index) => (
              <div className="ranking-row" key={student.id}>
                <span className={`rank-number rank-${index + 1}`}>{index + 1}</span>
                <div><strong>{student.name}</strong><small>{student.grade}</small></div>
                <b>{student.average}%</b>
              </div>
            )) : <div className="empty-state">لا توجد نتائج كافية للترتيب.</div>}
          </div>
        </article>

        <article className="panel premium-panel alerts-panel">
          <div className="panel-title">
            <div><span className="eyebrow">يحتاج انتباهك</span><h3>تنبيهات اليوم</h3></div>
            <Bell size={22} />
          </div>
          <button onClick={() => navigate('messages')}><MessageCircle size={19} /><span><strong>{readyNotifications} رسائل جاهزة</strong><small>راجع تنبيهات الغياب والدرجات</small></span><ArrowLeft size={16} /></button>
          <button onClick={() => navigate('payments')}><WalletCards size={19} /><span><strong>{due} ج مستحقات</strong><small>خاصة بالمجموعة الحالية</small></span><ArrowLeft size={16} /></button>
          <button onClick={() => navigate('reports')}><Trophy size={19} /><span><strong>تقرير الأداء</strong><small>الطلاب الذين يحتاجون متابعة</small></span><ArrowLeft size={16} /></button>
        </article>
      </div>
    </section>
  );
}
