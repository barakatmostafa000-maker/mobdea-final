import { useEffect, useMemo, useState } from 'react';
import {
  UserRound,
  UsersRound,
  ShieldCheck,
  MessageCircle,
  WalletCards,
  GraduationCap,
} from 'lucide-react';

const messageStatusLabel = { ready: 'جديدة', sent: 'تم الإرسال', postponed: 'مؤجلة', failed: 'فشل', cancelled: 'ألغيت' };
const messageTypeLabel = { absence: 'تنبيه غياب', late: 'تنبيه تأخر', due: 'تذكير مستحقات', praise: 'تميز', followup: 'متابعة مستوى' };

const normalizePhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export default function PortalPreview({ data, auth }) {
  const isRealUser = auth?.role === 'student' || auth?.role === 'guardian';
  const [simRole, setSimRole] = useState('student');
  const [simStudentId, setSimStudentId] = useState(data.students[0]?.id || '');

  const role = isRealUser ? (auth.role === 'guardian' ? 'parent' : 'student') : simRole;

  const linkedStudents = useMemo(() => {
    const students = Array.isArray(data.students) ? data.students : [];
    if (!isRealUser || role !== 'parent') return students;

    const explicitIds = [
      auth?.studentId,
      ...(Array.isArray(auth?.studentIds) ? auth.studentIds : []),
      ...(Array.isArray(auth?.linkedStudentIds) ? auth.linkedStudentIds : []),
      ...(Array.isArray(auth?.childIds) ? auth.childIds : []),
    ]
      .map(Number)
      .filter(Number.isFinite);

    const anchor = students.find((item) => explicitIds.includes(Number(item.id)));
    const guardianPhone = normalizePhone(auth?.guardianPhone || anchor?.guardianPhone || '');

    const linked = students.filter((item) => {
      if (explicitIds.includes(Number(item.id))) return true;
      return guardianPhone && normalizePhone(item.guardianPhone) === guardianPhone;
    });

    return linked.length
      ? linked
      : students.filter((item) => Number(item.id) === Number(auth?.studentId));
  }, [auth, data.students, isRealUser, role]);

  useEffect(() => {
    if (role !== 'parent' || !linkedStudents.length) return;
    const stillLinked = linkedStudents.some((item) => Number(item.id) === Number(simStudentId));
    if (!stillLinked) setSimStudentId(linkedStudents[0].id);
  }, [linkedStudents, role, simStudentId]);

  const studentId = isRealUser
    ? role === 'parent'
      ? simStudentId || linkedStudents[0]?.id || auth.studentId
      : auth.studentId
    : simStudentId;

  const student = data.students.find((item) => Number(item.id) === Number(studentId));

  const stats = useMemo(() => {
    const attendance = (data.attendance || []).filter((item) => Number(item.studentId) === Number(student?.id));
    const present = attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
    const grades = (data.grades || []).filter((item) => Number(item.studentId) === Number(student?.id));
    const validGrades = grades.filter((item) => Number(item.total) > 0);
    const average = validGrades.length
      ? Math.round(validGrades.reduce((sum, item) => sum + (Number(item.score) / Number(item.total)) * 100, 0) / validGrades.length)
      : 0;

    const payments = (data.payments || []).filter((item) => Number(item.studentId) === Number(student?.id));
    const totalDue = payments.filter((item) => item.type === 'due').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = payments.filter((item) => item.type === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const adjustments = payments.filter((item) => ['discount', 'exempt'].includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const remaining = Math.max(0, totalDue - totalPaid - adjustments);

    return {
      attendanceRate,
      average,
      gradeCount: grades.length,
      totalDue,
      totalPaid,
      adjustments,
      remaining,
      paymentStatus: remaining <= 0 ? 'تم السداد' : totalPaid > 0 ? 'سداد جزئي' : 'مستحق',
    };
  }, [data.attendance, data.grades, data.payments, student?.id]);

  const messages = useMemo(() => {
    if (role !== 'parent' || !student) return [];
    return (data.notifications || [])
      .filter((item) => Number(item.studentId) === Number(student.id))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20);
  }, [data.notifications, role, student]);

  if (!student) return <section className="page"><div className="panel empty-state">{isRealUser ? 'تعذر العثور على بيانات الحساب المرتبط، تواصل مع المعلم.' : 'أضف طالبًا أولًا.'}</div></section>;

  const studentPermissions = student.permissions || {};
  const parentPermissions = student.parentPermissions || {};
  const canSee = (key) => role === 'student' ? studentPermissions[key] !== false : parentPermissions[key] !== false;

  return <section className="page">
    {!isRealUser && <div className="page-heading"><div><span className="eyebrow">معاينة الصلاحيات</span><h2>ما يراه الطالب وولي الأمر</h2><p>راجع الواجهة قبل إتاحتها للمستخدمين.</p></div></div>}
    {isRealUser && <div className="page-heading"><div><span className="eyebrow">{role === 'parent' ? 'بوابة ولي الأمر' : 'بوابة الطالب'}</span><h2>مرحبًا، {role === 'parent' ? 'ولي الأمر' : student.name}</h2><p>{role === 'parent' ? 'اختر أحد الأبناء المرتبطين بنفس رقم ولي الأمر لمراجعة حسابه.' : 'هذه بياناتك فقط، ولا تظهر لك بيانات أي طالب آخر.'}</p></div></div>}

    {!isRealUser && <div className="portal-toolbar panel">
      <div className="portal-role-tabs">
        <button className={simRole === 'student' ? 'active' : ''} onClick={() => setSimRole('student')}><UserRound size={18}/> الطالب</button>
        <button className={simRole === 'parent' ? 'active' : ''} onClick={() => setSimRole('parent')}><UsersRound size={18}/> ولي الأمر</button>
      </div>
      <select value={simStudentId} onChange={(event) => setSimStudentId(event.target.value)}>{data.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </div>}

    {isRealUser && role === 'parent' && <div className="portal-toolbar panel portal-child-switcher">
      <div><UsersRound size={19}/><strong>حسابات الأبناء المرتبطة</strong><small>{linkedStudents.length} حساب</small></div>
      <select value={studentId || ''} onChange={(event) => setSimStudentId(event.target.value)} aria-label="اختيار الابن">
        {linkedStudents.map((item) => <option key={item.id} value={item.id}>{item.name} — كود {item.code || item.id}</option>)}
      </select>
    </div>}

    <div className="portal-preview-shell">
      <header><div className="portal-avatar">{student.name.charAt(0)}</div><div><strong>مرحبًا، {student.name}</strong><span>{role === 'student' ? 'بوابة الطالب' : `${student.grade || 'الصف غير محدد'} • ${student.group || 'المجموعة غير محددة'}`}</span></div><ShieldCheck size={24}/></header>

      {role === 'parent' && <div className="portal-account-strip">
        <span><UserRound size={15}/> كود الطالب: <strong>{student.code || student.id}</strong></span>
        <span><GraduationCap size={15}/> {student.grade || 'الصف غير محدد'}</span>
      </div>}

      <div className="portal-cards">
        {canSee('attendance') && <article><span>نسبة الحضور</span><strong>{stats.attendanceRate}%</strong><small>السجلات المسجلة</small></article>}
        {canSee('grades') && <article><span>متوسط الدرجات</span><strong>{stats.average}%</strong><small>{stats.gradeCount} اختبار/نتيجة</small></article>}
        {role === 'parent' && canSee('dues') && <article><span>المتبقي</span><strong>{stats.remaining} ج</strong><small>{stats.paymentStatus}</small></article>}
        {role === 'student' && canSee('games') && <article><span>الألعاب</span><strong>مفتوحة</strong><small>الألعاب المسموح بها</small></article>}
        {role === 'student' && canSee('content') && <article><span>المحتوى</span><strong>متاح</strong><small>الفيديوهات والوسائل</small></article>}
      </div>

      {role === 'parent' && canSee('dues') && <div className="portal-finance-summary">
        <h4><WalletCards size={17}/> الحساب والمستحقات</h4>
        <div className="portal-cards">
          <article><span>إجمالي المستحق</span><strong>{stats.totalDue} ج</strong></article>
          <article><span>إجمالي المدفوع</span><strong>{stats.totalPaid} ج</strong></article>
          <article><span>خصم/إعفاء</span><strong>{stats.adjustments} ج</strong></article>
          <article><span>المتبقي</span><strong>{stats.remaining} ج</strong><small>{stats.paymentStatus}</small></article>
        </div>
      </div>}

      {role === 'parent' && <div className="portal-messages">
        <h4><MessageCircle size={17}/> الرسائل من المعلم</h4>
        {messages.length ? messages.map((item) => (
          <div className="portal-message-row" key={item.id}>
            <div><strong>{messageTypeLabel[item.type] || item.type}</strong><small>{item.date || ''}</small></div>
            <span className={`notification-status ${item.status}`}>{messageStatusLabel[item.status] || item.status}</span>
          </div>
        )) : <div className="empty-state">لا توجد رسائل بعد.</div>}
      </div>}
      <div className="portal-private-note">لا تظهر إلا حسابات الأبناء المرتبطة بنفس رقم ولي الأمر، ولا تظهر الحسابات العامة أو تقارير الإدارة.</div>
    </div>
  </section>;
}
