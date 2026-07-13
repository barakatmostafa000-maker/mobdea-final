import { formatTime12 } from '../utils/time';
import StatCard from '../components/StatCard';

export default function Dashboard({ data, navigate }) {
  const currentSession = data.sessions.find((s) => s.current);
  const students = currentSession
    ? data.students.filter((s) => s.group === currentSession.group)
    : [];

  const today = new Date().toISOString().slice(0, 10);
  const attendance = data.attendance.filter((a) => a.date === today && students.some((s) => s.id === a.studentId));
  const present = attendance.filter((a) => ['present', 'late'].includes(a.status)).length;
  const average = students.length
    ? Math.round(students.reduce((sum, student) => {
        const grades = data.grades.filter((g) => g.studentId === student.id);
        const avg = grades.length ? grades.reduce((n, g) => n + (g.score / g.total) * 100, 0) / grades.length : 0;
        return sum + avg;
      }, 0) / students.length)
    : 0;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">لوحة الحصة الحالية</span>
          <h2>{currentSession ? `${currentSession.title} — ${currentSession.group}` : 'لا توجد حصة حالية'}</h2>
          <p>كل الأرقام هنا تخص طلاب الحصة الحالية فقط.</p>
        </div>
        <div className="date-chip">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>

      <div className="stats-grid">
        <StatCard icon="👥" label="طلاب الحصة" value={students.length} hint="المجموعة الحالية" />
        <StatCard icon="✅" label="الحضور" value={present} hint={`${Math.max(0, students.length - present)} غير مسجل`} />
        <StatCard icon="🏆" label="متوسط الدرجات" value={`${average}%`} hint="طلاب الحصة" />
        <StatCard icon="🎮" label="جولات الألعاب" value={data.gameResults.filter((r) => students.some((s) => s.id === r.studentId)).length} hint="نتائج محفوظة" />
      </div>

      <div className="dashboard-grid">
        <article className="panel current-session">
          <span className="live-badge">● الحصة الحالية</span>
          <h3>{currentSession?.title || 'حدد حصة حالية'}</h3>
          <p>{currentSession ? `${currentSession.day} • ${formatTime12(currentSession.time)} • ${currentSession.price} ج` : 'من قسم الحصص والمجموعات'}</p>
          <div className="quick-actions">
            <button onClick={() => navigate('classMode')}>بدء وضع الحصة</button>
            <button onClick={() => navigate('students')}>إضافة طالب</button>
            <button onClick={() => navigate('grades')}>رصد درجة</button>
            <button onClick={() => navigate('messages')}>رسالة ولي أمر</button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title"><h3>طلاب الحصة</h3><button onClick={() => navigate('students')}>عرض الكل</button></div>
          <div className="student-list">
            {students.length ? students.map((student) => (
              <div key={student.id} className="student-row">
                <span className="student-code">{student.code}</span>
                <div><strong>{student.name}</strong><small>{student.grade}</small></div>
                <span className="status-pill">لم يسجل</span>
              </div>
            )) : <div className="empty-state">لا يوجد طلاب في الحصة الحالية.</div>}
          </div>
        </article>
      </div>
    </section>
  );
}
