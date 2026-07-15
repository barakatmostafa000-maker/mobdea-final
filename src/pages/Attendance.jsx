import { buildAttendanceMessage, openWhatsApp } from '../services/whatsapp';
import { queueAbsenceNotification } from '../services/notifications';
import { todayISO } from '../utils/time';

const labels = { present:'حاضر', late:'متأخر', absent:'غائب', excused:'غياب بعذر' };

export default function Attendance({ data, updateData }) {
  const current = data.sessions.find((s) => s.current);
  const students = current ? data.students.filter((s) => s.group === current.group) : [];
  const today = todayISO();

  const recordFor = (id) => data.attendance.find((a) => a.studentId === id && a.date === today && a.sessionId === current?.id);

  const mark = (student, status) => {
    const existing = recordFor(student.id);
    const attendance = existing
      ? data.attendance.map((a) => a.id === existing.id ? { ...a, status } : a)
      : [...data.attendance, { id: Date.now()+Math.random(), studentId: student.id, status, date: today, sessionId: current?.id }];

    let next = { ...data, attendance };
    if (status === 'absent') next = queueAbsenceNotification(next, student, current, today);
    updateData(next);
  };

  const notify = (student, status) => {
    openWhatsApp(student.guardianPhone, buildAttendanceMessage(student.name, status, today));
  };

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">الحصة الحالية فقط</span><h2>الحضور والغياب</h2><p>{current ? `${current.title} — ${current.group}` : 'لا توجد حصة حالية'}</p></div></div>
    <div className="panel"><div className="attendance-list">
      {students.map((student) => {
        const status = recordFor(student.id)?.status;
        return <div className="attendance-row" key={student.id}>
          <span className="student-code">{student.code}</span>
          <div className="attendance-name"><strong>{student.name}</strong><small>{student.group}</small></div>
          <div className="attendance-actions">
            {['present','late','absent','excused'].map((key)=><button key={key} className={status===key?`selected ${key}-btn`:`${key}-btn`} onClick={()=>mark(student,key)}>{labels[key]}</button>)}
            {status && <button className="whatsapp-btn" onClick={()=>notify(student,status)}>واتساب</button>}
          </div>
        </div>;
      })}
      {!students.length && <div className="empty-state">حدد حصة حالية بها طلاب.</div>}
    </div></div>
  </section>;
}
