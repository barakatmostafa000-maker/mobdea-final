import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  MapPinned,
  MessageCircle,
  Presentation,
  QrCode,
  Search,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { identity } from '../config/identity';
import { formatDateAr, formatTime12, todayISO } from '../utils/time';
import { roleGreeting, getRoleModules } from '../utils/auth';

const mainActions = [
  { id: 'students', title: 'إدارة الطلاب', hint: 'إضافة وتعديل بيانات الطلاب ومتابعة ملفاتهم', icon: Users, tone: 'violet' },
  { id: 'attendance', title: 'الحضور والغياب', hint: 'تسجيل الحضور يدويًا أو باستخدام QR', icon: CheckCircle2, tone: 'green' },
  { id: 'reports', title: 'الدرجات والتقارير', hint: 'إدخال الدرجات واستعراض النتائج والتحليلات', icon: Trophy, tone: 'blue' },
  { id: 'contentLibrary', title: 'الدروس والمحتوى', hint: 'إدارة الدروس والملفات والشرح والوسائط', icon: BookOpen, tone: 'red' },
  { id: 'games', title: 'الألعاب التعليمية', hint: 'ألعاب تفاعلية لتعزيز الفهم والمراجعة', icon: Gamepad2, tone: 'amber' },
  { id: 'contentLibrary', title: 'المكتبة', hint: 'ملفات تعليمية وكتب وفيديوهات وخرائط', icon: FolderOpen, tone: 'orange' },
];

const searchableModules = [
  ['dashboard', 'الرئيسية', 'لوحة التحكم واليوم'],
  ['classMode', 'وضع الحصة', 'السبورة والطلاب والتفاعل'],
  ['whiteboard', 'السبورة', 'شرح وكتابة ورسم'],
  ['students', 'الطلاب', 'إدارة بيانات الطلاب'],
  ['studentCards', 'كروت الطلاب', 'الطباعة وQR'],
  ['sessions', 'الجدول والحصص', 'المجموعات والمواعيد'],
  ['attendance', 'الحضور والغياب', 'التسجيل والمتابعة'],
  ['grades', 'الدرجات', 'الامتحانات والنتائج'],
  ['reports', 'التقارير', 'تحليل الأداء'],
  ['contentLibrary', 'المكتبة والمحتوى', 'PDF وصور وفيديو'],
  ['games', 'الألعاب التعليمية', 'تحديات ومراجعة'],
  ['mapChallenge', 'تحدي الخرائط', 'الدول والتضاريس'],
  ['messages', 'أولياء الأمور', 'التنبيهات والرسائل'],
  ['payments', 'الحسابات', 'المستحقات والمدفوعات'],
];

function ActionCard({ action, onClick }) {
  const Icon = action.icon;
  return (
    <button className={`dashboard-feature-card ${action.tone}`} onClick={onClick} type="button">
      <span className="dashboard-feature-icon"><Icon size={30} /></span>
      <strong>{action.title}</strong>
      <small>{action.hint}</small>
      <span className="dashboard-feature-link">فتح القسم <ArrowLeft size={15} /></span>
    </button>
  );
}

function SearchResults({ query, results, onOpen, onClose }) {
  if (!query.trim()) return null;
  return (
    <div className="dashboard-search-results">
      <div className="dashboard-search-results-head">
        <strong>نتائج البحث</strong>
        <button type="button" onClick={onClose} aria-label="إغلاق نتائج البحث"><X size={16} /></button>
      </div>
      {results.length ? results.map((result) => (
        <button key={result.key} type="button" onClick={() => onOpen(result)}>
          <span className="dashboard-search-result-icon">{result.icon}</span>
          <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
          <ArrowLeft size={15} />
        </button>
      )) : <div className="dashboard-search-empty">لا توجد نتيجة مطابقة.</div>}
    </div>
  );
}

export default function Dashboard({ data, navigate, auth }) {
  const [query, setQuery] = useState('');
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
  const readyNotifications = (data.notifications || []).filter((item) => item.status === 'ready');
  const due = (data.payments || []).filter((item) => item.type === 'due' && focusStudents.some((student) => student.id === item.studentId)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const greeting = roleGreeting(auth?.role);
  const roleModules = getRoleModules(auth?.role);
  const canOpen = (id) => !roleModules || roleModules.has(id);

  const ranked = useMemo(() => focusStudents
    .map((student) => {
      const grades = (data.grades || []).filter((grade) => grade.studentId === student.id);
      const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + (grade.score / Math.max(1, grade.total)) * 100, 0) / grades.length) : 0;
      return { ...student, average };
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 10), [focusStudents, data.grades]);

  const todaysPlan = useMemo(() => sessions.slice(0, 4), [sessions]);
  const upcomingExams = useMemo(() => (data.exams || []).slice(0, 3), [data.exams]);
  const announcements = useMemo(() => {
    const fromNotifications = readyNotifications.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.type === 'absence' ? 'تنبيه غياب يحتاج إرسالًا' : item.type === 'low-grade' ? 'نتيجة تحتاج متابعة' : 'تنبيه جديد',
      subtitle: item.date || today,
      tone: item.type === 'absence' ? 'red' : 'orange',
    }));
    return fromNotifications.length ? fromNotifications : [
      { id: 'welcome', title: 'ابدأ الحصة من لوحة التحكم', subtitle: 'كل الأدوات متصلة ببيانات المنصة', tone: 'gold' },
    ];
  }, [readyNotifications, today]);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const modules = searchableModules
      .filter(([id]) => canOpen(id))
      .filter(([, title, subtitle]) => `${title} ${subtitle}`.toLowerCase().includes(needle))
      .map(([id, title, subtitle]) => ({ key: `module-${id}`, type: 'module', id, title, subtitle, icon: <LayoutDashboard size={17} /> }));
    const students = (data.students || [])
      .filter((student) => `${student.name} ${student.code} ${student.grade} ${student.group}`.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((student) => ({ key: `student-${student.id}`, type: 'student', id: student.id, title: student.name, subtitle: `${student.code} — ${student.grade}`, icon: <GraduationCap size={17} /> }));
    const resources = (data.contentLibrary || [])
      .filter((resource) => `${resource.title} ${resource.unit} ${resource.lesson} ${resource.grade}`.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((resource) => ({ key: `resource-${resource.id}`, type: 'resource', id: resource.id, title: resource.title, subtitle: `${resource.grade || ''} — ${resource.lesson || resource.type}`, icon: <LibraryBig size={17} /> }));
    return [...modules, ...students, ...resources].slice(0, 10);
  }, [query, data.students, data.contentLibrary, roleModules]);

  const openSearchResult = (result) => {
    setQuery('');
    if (result.type === 'student') navigate('students');
    else if (result.type === 'resource') navigate('contentLibrary');
    else navigate(result.id);
  };

  return (
    <section className="page dashboard-page dashboard-reference-layout dashboard-v103">
      <div className="dashboard-desktop-topbar">
        <div className="dashboard-search-wrap">
          <Search size={21} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث هنا..." aria-label="البحث داخل المنصة" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={17} /></button>}
          <SearchResults query={query} results={searchResults} onOpen={openSearchResult} onClose={() => setQuery('')} />
        </div>
        <div className="dashboard-account-strip">
          <button type="button" className="dashboard-bell" onClick={() => navigate('messages')} aria-label="فتح التنبيهات">
            <Bell size={22} />
            {readyNotifications.length > 0 && <b>{readyNotifications.length}</b>}
          </button>
          <button type="button" className="dashboard-account" onClick={() => navigate('settings')}>
            <span><strong>{greeting}</strong><small>{auth?.role === 'teacher' ? 'معلم دراسات' : auth?.displayName || identity.teacherTitle}</small></span>
            <img src={identity.portrait} alt={identity.teacherName} />
          </button>
        </div>
      </div>

      <article className="dashboard-reference-hero">
        <div className="dashboard-reference-copy">
          <span className="dashboard-reference-kicker">منصة</span>
          <h2>المُبدع</h2>
          <h3>لتعليم ممتع</h3>
          <p>منصة متكاملة لإدارة التعليم والحضور والدرجات والمدفوعات والاختبارات في مكان واحد.</p>
          <div className="dashboard-reference-cta">
            {canOpen('classMode') && <button type="button" className="hero-primary" onClick={() => navigate('classMode')}><Presentation size={20} /> ابدأ الحصة الآن</button>}
            {canOpen('sessions') && <button type="button" className="hero-secondary" onClick={() => navigate('sessions')}><CalendarDays size={19} /> عرض الجدول</button>}
          </div>
        </div>

        <div className="dashboard-reference-portrait">
          <div className="dashboard-map-paper" aria-hidden="true">
            <span>خريطة العالم</span>
            <small>في العصور الوسطى</small>
          </div>
          <div className="dashboard-banner" aria-hidden="true"><BookOpen size={38} /><span>العلم نور الحياة</span></div>
          <img src={identity.portrait} alt={identity.teacherName} />
          <div className="dashboard-history-books" aria-hidden="true"><span>الحضارات القديمة</span><span>الجغرافيا التاريخية</span><span>دراسات اجتماعية</span></div>
        </div>

        <aside className="dashboard-today-panel">
          <div className="dashboard-today-head"><CalendarClock size={22} /><div><strong>جدول اليوم</strong><small>{formatDateAr(today)}</small></div></div>
          <div className="dashboard-today-list">
            {todaysPlan.length ? todaysPlan.map((session, index) => (
              <button type="button" key={session.id || index} onClick={() => navigate('sessions')}>
                <span className={`schedule-dot tone-${index + 1}`}><Users size={15} /></span>
                <strong>{session.title || session.group}</strong>
                <small>{formatTime12(session.time)}</small>
              </button>
            )) : <div className="dashboard-today-empty">لا توجد حصص مسجلة اليوم.</div>}
          </div>
          <button type="button" className="dashboard-full-schedule" onClick={() => navigate('sessions')}>عرض الجدول الكامل <ArrowLeft size={16} /></button>
        </aside>
      </article>

      <div className="dashboard-feature-grid">
        {mainActions.filter((action) => canOpen(action.id)).map((action, index) => (
          <ActionCard key={`${action.id}-${index}`} action={action} onClick={() => navigate(action.id)} />
        ))}
      </div>

      <div className="dashboard-reference-bottom">
        <article className="dashboard-current-class-card">
          <div className="dashboard-current-art" aria-hidden="true"><MapPinned size={45} /><BookOpen size={35} /></div>
          <div>
            <span>الحصة الحالية</span>
            <h3>{currentSession?.title || 'لا توجد حصة حالية'}</h3>
            <p>{currentSession ? `${currentSession.group} — ${formatTime12(currentSession.time)}` : 'اختر الحصة الحالية من الجدول'}</p>
            <strong>{String(Math.floor((currentSession ? 2120 : 0) / 60)).padStart(2, '0')}:20</strong>
          </div>
          <button type="button" onClick={() => navigate('classMode')} disabled={!currentSession}>فتح الحصة</button>
        </article>

        <article className="dashboard-lower-panel">
          <div className="dashboard-lower-title"><MessageCircle size={19} /><strong>آخر الإعلانات</strong></div>
          <div className="dashboard-announcement-list">
            {announcements.map((item) => <button type="button" key={item.id} onClick={() => navigate('messages')}><i className={item.tone} /><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button>)}
          </div>
          <button type="button" className="dashboard-lower-link" onClick={() => navigate('messages')}>عرض جميع الإعلانات</button>
        </article>

        <article className="dashboard-lower-panel">
          <div className="dashboard-lower-title"><CalendarDays size={19} /><strong>الاختبارات القادمة</strong></div>
          <div className="dashboard-announcement-list">
            {upcomingExams.length ? upcomingExams.map((exam, index) => (
              <button type="button" key={exam.id || index} onClick={() => navigate('grades')}><i className={index === 0 ? 'red' : 'orange'} /><span><strong>{exam.title || exam.name || 'اختبار'}</strong><small>{exam.date || exam.grade || 'جميع المراحل'}</small></span></button>
            )) : <div className="dashboard-today-empty">لا توجد اختبارات قادمة.</div>}
          </div>
          <button type="button" className="dashboard-lower-link" onClick={() => navigate('grades')}>عرض جميع الاختبارات</button>
        </article>
      </div>

      <div className="dashboard-hidden-live-metrics" aria-label="ملخص مباشر">
        <span><Users size={16} /> {focusStudents.length} طالب</span>
        <span><CheckCircle2 size={16} /> {present} حاضر</span>
        <span><QrCode size={16} /> {absent} غائب</span>
        <span><WalletCards size={16} /> {due} ج مستحقات</span>
      </div>
    </section>
  );
}
