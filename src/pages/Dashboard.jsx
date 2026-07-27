import {
  ArrowLeft,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Gamepad2,
  LayoutGrid,
  MessageCircle,
  Presentation,
  QrCode,
  Sparkles,
  Settings,
  Trophy,
  Eye,
  Users,
  WalletCards,
} from 'lucide-react';
import { identity } from '../config/identity';
import { formatTime12, todayISO } from '../utils/time';
import { roleGreeting, getRoleModules } from '../utils/auth';

function ActionButton({ icon: Icon, title, hint, onClick, tone = '' }) {
  return (
    <button className={`dashboard-action ${tone}`} onClick={onClick} type="button">
      <span><Icon size={21} /></span>
      <div>
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
      <ArrowLeft size={16} />
    </button>
  );
}

function StatBlock({ value, label }) {
  return (
    <div className="dashboard-mini-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Dashboard({ data, navigate, auth }) {
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const currentSession = sessions.find((session) => session.current) || sessions[0] || null;
  const currentGroup = currentSession?.group || '';
  const authStudent = auth?.studentId ? data.students.find((student) => student.id === auth.studentId) : null;
  const focusStudents = auth?.role === 'student' || auth?.role === 'guardian'
    ? (authStudent ? [authStudent] : [])
    : currentGroup
      ? (data.students || []).filter((student) => student.group === currentGroup)
      : (data.students || []);
  const today = todayISO();
  const attendance = (data.attendance || []).filter((item) => item.date === today && focusStudents.some((student) => student.id === item.studentId));
  const present = attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
  const absent = attendance.filter((item) => item.status === 'absent').length;
  const readyNotifications = (data.notifications || []).filter((item) => item.status === 'ready').length;
  const due = (data.payments || []).filter((item) => item.type === 'due' && focusStudents.some((student) => student.id === item.studentId)).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const ranked = focusStudents
    .map((student) => {
      const grades = (data.grades || []).filter((grade) => grade.studentId === student.id);
      const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + (grade.score / grade.total) * 100, 0) / grades.length) : 0;
      return { ...student, average };
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 4);

  const todaysPlan = (sessions.length ? sessions : [currentSession]).filter(Boolean).slice(0, 4);
  const upcomingExams = (data.exams || []).slice(0, 3);
  const greeting = roleGreeting(auth?.role);
  const roleModules = getRoleModules(auth?.role);
  const canOpen = (id) => !roleModules || roleModules.has(id);

  return (
    <section className="page dashboard-page">
      <article className="dashboard-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> {greeting} — {identity.schoolName}</div>
          <h2>أهلاً {authStudent?.name || 'أستاذ مصطفى'}، كل شيء اليوم أمامك في لوحة واحدة.</h2>
          <p>ابدأ الحصة، راقب الحضور، افتح الشرح، وحرّك المتابعة من شاشة واحدة متناسقة مع المنصة والتابلت.</p>
          <div className="hero-actions">
            {canOpen('classMode') && <button className="hero-primary" onClick={() => navigate('classMode')} type="button"><Presentation size={20} /> بدء وضع الحصة</button>}
            {canOpen('sessions') && <button className="hero-secondary" onClick={() => navigate('sessions')} type="button"><CalendarClock size={19} /> عرض الجدول</button>}
            {!canOpen('classMode') && !canOpen('sessions') && <button className="hero-secondary" onClick={() => navigate('portalPreview')} type="button"><Eye size={19} /> عرض الصلاحيات</button>}
          </div>

          <div className="hero-info-strip">
            <StatBlock value={focusStudents.length} label="طلاب / حسابات" />
            <StatBlock value={present} label="حاضر" />
            <StatBlock value={absent} label="غائب" />
            <StatBlock value={`${due} ج`} label="مستحقات" />
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-map" aria-hidden="true" />
          <img src={identity.portrait} alt={identity.teacherName} className="hero-visual-portrait" />
          <div className="hero-visual-copy">
            <span>منصة المُبدع</span>
            <strong>{identity.teacherName}</strong>
            <small>{identity.teacherTitle}</small>
          </div>
        </div>

        <aside className="hero-session-card">
          <span className="live-badge">● جدول اليوم</span>
          <h3>{currentSession?.title || 'لا توجد حصة حالياً'}</h3>
          <p>{currentSession ? `${currentSession.group} • ${currentSession.day} • ${formatTime12(currentSession.time)}` : 'أضف الحصة الحالية من قسم الحصص والمجموعات'}</p>

          <div className="hero-session-list">
            {todaysPlan.map((session, index) => (
              <div key={session.id || `${session.title}-${index}`} className="hero-session-row">
                <strong>{session.day} • {formatTime12(session.time)}</strong>
                <span>{session.title}</span>
              </div>
            ))}
          </div>

          {upcomingExams.length > 0 && (
            <div className="hero-upcoming-box">
              <span>الاختبارات القادمة</span>
              {upcomingExams.map((exam, index) => (
                <strong key={exam.id || `${exam.title}-${index}`}>{exam.title || exam.name || 'اختبار'}</strong>
              ))}
            </div>
          )}
        </aside>
      </article>

      <div className="dashboard-summary-strip">
        <div><Users size={21} /><span><small>طلاب المجموعة</small><strong>{focusStudents.length}</strong></span></div>
        <div><CheckCircle2 size={21} /><span><small>الحضور المسجل</small><strong>{present}/{focusStudents.length}</strong></span></div>
        <div><MessageCircle size={21} /><span><small>رسائل جاهزة</small><strong>{readyNotifications}</strong></span></div>
        <div><WalletCards size={21} /><span><small>مستحقات المجموعة</small><strong>{due} ج</strong></span></div>
      </div>

      <div className="dashboard-section-heading">
        <div><span className="eyebrow">وصول سريع</span><h3>الإجراءات السريعة</h3></div>
        <small>كل الأدوات الأساسية على بُعد ضغطة</small>
      </div>

      <div className="dashboard-actions-grid">
        {canOpen('students') && <ActionButton icon={Users} title="الطلاب" hint="إدارة البيانات والمجموعات" onClick={() => navigate('students')} />}
        {canOpen('attendance') && <ActionButton icon={QrCode} title="الحضور" hint="يدوي أو باستخدام الكود" onClick={() => navigate('attendance')} />}
        {canOpen('grades') && <ActionButton icon={BookOpenCheck} title="الدرجات" hint="النتائج والترتيب" onClick={() => navigate('grades')} />}
        {canOpen('classMode') && <ActionButton icon={Presentation} title="الدروس" hint="وضع الحصة والشرح" onClick={() => navigate('classMode')} tone="gold" />}
        {canOpen('games') && <ActionButton icon={Gamepad2} title="الألعاب" hint="الجولات والتحديات" onClick={() => navigate('games')} />}
        {canOpen('contentLibrary') && <ActionButton icon={BookOpen} title="المكتبة" hint="الملفات والخرائط" onClick={() => navigate('contentLibrary')} />}
        {canOpen('reports') && <ActionButton icon={LayoutGrid} title="التقارير" hint="متابعة الأداء" onClick={() => navigate('reports')} />}
        {canOpen('settings') && <ActionButton icon={Settings} title="الإعدادات" hint="الحماية والصوت" onClick={() => navigate('settings')} />}
      </div>

      <div className="dashboard-content-grid">
        <article className="panel premium-panel">
          <div className="panel-title">
            <div><span className="eyebrow">الحصة الحالية</span><h3>طلاب المجموعة</h3></div>
            <button type="button" onClick={() => navigate('students')}>عرض الكل</button>
          </div>
          <div className="dashboard-student-list">
            {focusStudents.length ? focusStudents.slice(0, 6).map((student) => {
              const status = attendance.find((item) => item.studentId === student.id)?.status;
              return (
                <button key={student.id} className="dashboard-student-row" onClick={() => navigate('classMode')} type="button">
                  <span className="student-code">{student.code}</span>
                  <span><strong>{student.name}</strong><small>{student.grade}</small></span>
                  <b className={`attendance-dot ${status || 'pending'}`}>{status === 'present' ? 'حاضر' : status === 'late' ? 'متأخر' : status === 'absent' ? 'غائب' : 'لم يسجل'}</b>
                </button>
              );
            }) : <div className="empty-state">لا يوجد طلاب في النطاق الحالي.</div>}
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
          {canOpen('messages') && <button type="button" onClick={() => navigate('messages')}><MessageCircle size={19} /><span><strong>{readyNotifications} رسائل جاهزة</strong><small>راجع تنبيهات الغياب والدرجات</small></span><ArrowLeft size={16} /></button>}
          {canOpen('payments') && <button type="button" onClick={() => navigate('payments')}><WalletCards size={19} /><span><strong>{due} ج مستحقات</strong><small>خاصة بالمجموعة الحالية</small></span><ArrowLeft size={16} /></button>}
          {canOpen('reports') && <button type="button" onClick={() => navigate('reports')}><Trophy size={19} /><span><strong>تقرير الأداء</strong><small>الطلاب الذين يحتاجون متابعة</small></span><ArrowLeft size={16} /></button>}
        </article>
      </div>
    </section>
  );
}
