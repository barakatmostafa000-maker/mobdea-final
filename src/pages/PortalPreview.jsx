import { useMemo, useState } from 'react';
import { UserRound, UsersRound, ShieldCheck, MessageCircle } from 'lucide-react';

const messageStatusLabel = { ready: 'جديدة', sent: 'تم الإرسال', postponed: 'مؤجلة', failed: 'فشل', cancelled: 'ألغيت' };
const messageTypeLabel = { absence: 'تنبيه غياب', late: 'تنبيه تأخر', due: 'تذكير مستحقات', praise: 'تميز', followup: 'متابعة مستوى' };

export default function PortalPreview({ data, auth }) {
  const isRealUser = auth?.role === 'student' || auth?.role === 'guardian';
  const [simRole, setSimRole] = useState('student');
  const [simStudentId, setSimStudentId] = useState(data.students[0]?.id || '');

  // Real students/guardians are locked to their own linked record — no picker,
  // no ability to select another student's id. Admin/teacher keep the free
  // simulator (pick any student + toggle role) to preview permissions before
  // publishing them, exactly as before.
  const role = isRealUser ? (auth.role === 'guardian' ? 'parent' : 'student') : simRole;
  const studentId = isRealUser ? auth.studentId : simStudentId;
  const student = data.students.find((item) => item.id === Number(studentId));

  const stats = useMemo(() => {
    const attendance = data.attendance.filter((item) => item.studentId === student?.id);
    const present = attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    const grades = data.grades.filter((item) => item.studentId === student?.id);
    const average = grades.length ? Math.round(grades.reduce((sum, item) => sum + (item.score / item.total) * 100, 0) / grades.length) : 0;
    const due = data.payments.filter((item) => item.studentId === student?.id && item.type === 'due').reduce((sum, item) => sum + item.amount, 0);
    return { attendanceRate, average, due };
  }, [data, student?.id]);

  const messages = useMemo(() => {
    if (role !== 'parent' || !student) return [];
    return (data.notifications || [])
      .filter((item) => item.studentId === student.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20);
  }, [data.notifications, role, student]);

  if (!student) return <section className="page"><div className="panel empty-state">{isRealUser ? 'تعذر العثور على بيانات الحساب المرتبط، تواصل مع المعلم.' : 'أضف طالبًا أولًا.'}</div></section>;

  const studentPermissions = student.permissions || {};
  const parentPermissions = student.parentPermissions || {};
  const canSee = (key) => role === 'student' ? studentPermissions[key] !== false : parentPermissions[key] !== false;

  return <section className="page">
    {!isRealUser && <div className="page-heading"><div><span className="eyebrow">معاينة الصلاحيات</span><h2>ما يراه الطالب وولي الأمر</h2><p>راجع الواجهة قبل إتاحتها للمستخدمين.</p></div></div>}
    {isRealUser && <div className="page-heading"><div><span className="eyebrow">{role === 'parent' ? 'بوابة ولي الأمر' : 'بوابة الطالب'}</span><h2>مرحبًا، {student.name}</h2><p>هذه بياناتك فقط، ولا تظهر لك بيانات أي طالب آخر.</p></div></div>}

    {!isRealUser && <div className="portal-toolbar panel">
      <div className="portal-role-tabs">
        <button className={simRole === 'student' ? 'active' : ''} onClick={() => setSimRole('student')}><UserRound size={18}/> الطالب</button>
        <button className={simRole === 'parent' ? 'active' : ''} onClick={() => setSimRole('parent')}><UsersRound size={18}/> ولي الأمر</button>
      </div>
      <select value={simStudentId} onChange={(event) => setSimStudentId(event.target.value)}>{data.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </div>}

    <div className="portal-preview-shell">
      <header><div className="portal-avatar">{student.name.charAt(0)}</div><div><strong>مرحبًا، {student.name}</strong><span>{role === 'student' ? 'بوابة الطالب' : 'بوابة ولي الأمر'}</span></div><ShieldCheck size={24}/></header>
      <div className="portal-cards">
        {canSee('attendance') && <article><span>نسبة الحضور</span><strong>{stats.attendanceRate}%</strong><small>السجلات المسجلة</small></article>}
        {canSee('grades') && <article><span>متوسط الدرجات</span><strong>{stats.average}%</strong><small>آخر الاختبارات</small></article>}
        {role === 'parent' && canSee('dues') && <article><span>المستحقات</span><strong>{stats.due} ج</strong><small>المبالغ المتبقية</small></article>}
        {role === 'student' && canSee('games') && <article><span>الألعاب</span><strong>مفتوحة</strong><small>الألعاب المسموح بها</small></article>}
        {role === 'student' && canSee('content') && <article><span>المحتوى</span><strong>متاح</strong><small>الفيديوهات والوسائل</small></article>}
      </div>
      {role === 'parent' && <div className="portal-messages">
        <h4><MessageCircle size={17}/> الرسائل من المعلم</h4>
        {messages.length ? messages.map((item) => (
          <div className="portal-message-row" key={item.id}>
            <div>
              <strong>{messageTypeLabel[item.type] || item.type}</strong>
              <small>{item.date || ''}</small>
            </div>
            <span className={`notification-status ${item.status}`}>{messageStatusLabel[item.status] || item.status}</span>
          </div>
        )) : <div className="empty-state">لا توجد رسائل بعد.</div>}
      </div>}
      <div className="portal-private-note">لن تظهر بيانات أي طالب آخر، ولا الحسابات العامة أو تقارير الإدارة.</div>
    </div>
  </section>;
}
