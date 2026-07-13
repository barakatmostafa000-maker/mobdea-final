export default function Reports({ data }) {
  const present = data.attendance.filter((a)=>['present','late'].includes(a.status)).length;
  const attendanceRate = data.attendance.length ? Math.round(present/data.attendance.length*100) : 0;
  const avg = data.grades.length ? Math.round(data.grades.reduce((n,g)=>n+(g.score/g.total)*100,0)/data.grades.length) : 0;
  const due = data.payments.filter((p)=>p.type==='due').reduce((n,p)=>n+p.amount,0);
  const followup = data.students.filter((student)=>{
    const grades=data.grades.filter((g)=>g.studentId===student.id);
    if(!grades.length)return false;
    return grades.reduce((n,g)=>n+(g.score/g.total)*100,0)/grades.length<60;
  });
  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">خاص بالإدارة</span><h2>التقارير العامة</h2><p>الإجماليات العامة لا تظهر في لوحة الحصة الحالية.</p></div></div>
    <div className="stats-grid"><div className="stat-card"><div><span>الطلاب</span><strong>{data.students.length}</strong><small>إجمالي المنصة</small></div></div><div className="stat-card"><div><span>نسبة الحضور</span><strong>{attendanceRate}%</strong><small>كل السجلات</small></div></div><div className="stat-card"><div><span>متوسط الدرجات</span><strong>{avg}%</strong><small>كل الامتحانات</small></div></div><div className="stat-card"><div><span>المستحقات</span><strong>{due} ج</strong><small>إجمالي المستحق</small></div></div></div>
    <div className="panel"><h3>طلاب يحتاجون متابعة</h3>{followup.length?followup.map((s)=><div className="student-row" key={s.id}><span className="student-code">{s.code}</span><div><strong>{s.name}</strong><small>{s.grade}</small></div><span className="status-pill">متابعة</span></div>):<div className="empty-state">لا يوجد طلاب تحت 60% حاليًا.</div>}</div>
  </section>;
}
