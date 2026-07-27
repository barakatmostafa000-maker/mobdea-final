import { useMemo, useState } from 'react';
import { UserRound, UsersRound, ShieldCheck } from 'lucide-react';

export default function PortalPreview({ data }) {
  const [role, setRole] = useState('student');
  const [studentId, setStudentId] = useState(data.students[0]?.id || '');
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

  if (!student) return <section className="page"><div className="panel empty-state">أضف طالبًا أولًا.</div></section>;

  const studentPermissions = student.permissions || {};
  const parentPermissions = student.parentPermissions || {};
  const canSee = (key) => role === 'student' ? studentPermissions[key] !== false : parentPermissions[key] !== false;

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">معاينة الصلاحيات</span><h2>ما يراه الطالب وولي الأمر</h2><p>راجع الواجهة قبل إتاحتها للمستخدمين.</p></div></div>

    <div className="portal-toolbar panel">
      <div className="portal-role-tabs">
        <button className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}><UserRound size={18}/> الطالب</button>
        <button className={role === 'parent' ? 'active' : ''} onClick={() => setRole('parent')}><UsersRound size={18}/> ولي الأمر</button>
      </div>
      <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{data.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </div>

    <div className="portal-preview-shell">
      <header><div className="portal-avatar">{student.name.charAt(0)}</div><div><strong>مرحبًا، {student.name}</strong><span>{role === 'student' ? 'بوابة الطالب' : 'بوابة ولي الأمر'}</span></div><ShieldCheck size={24}/></header>
      <div className="portal-cards">
        {canSee('attendance') && <article><span>نسبة الحضور</span><strong>{stats.attendanceRate}%</strong><small>السجلات المسجلة</small></article>}
        {canSee('grades') && <article><span>متوسط الدرجات</span><strong>{stats.average}%</strong><small>آخر الاختبارات</small></article>}
        {role === 'parent' && canSee('dues') && <article><span>المستحقات</span><strong>{stats.due} ج</strong><small>المبالغ المتبقية</small></article>}
        {role === 'student' && canSee('games') && <article><span>الألعاب</span><strong>مفتوحة</strong><small>الألعاب المسموح بها</small></article>}
        {role === 'student' && canSee('content') && <article><span>المحتوى</span><strong>متاح</strong><small>الفيديوهات والوسائل</small></article>}
      </div>
      <div className="portal-private-note">لن تظهر بيانات أي طالب آخر، ولا الحسابات العامة أو تقارير الإدارة.</div>
    </div>
  </section>;
}
