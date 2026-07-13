import { useMemo, useState } from 'react';
import { encourageStudent } from '../services/voice';
import { queueAbsenceNotification } from '../services/notifications';
import { formatTime12, todayISO } from '../utils/time';

const statusLabels = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  excused: 'غياب بعذر'
};

export default function ClassMode({ data, updateData, navigate }) {
  const current = data.sessions.find((session) => session.current);
  const students = current ? data.students.filter((student) => student.group === current.group) : [];
  const today = todayISO();
  const [lastPraise, setLastPraise] = useState('');

  const attendanceMap = useMemo(() => {
    return Object.fromEntries(
      data.attendance
        .filter((item) => item.date === today && item.sessionId === current?.id)
        .map((item) => [item.studentId, item.status])
    );
  }, [data.attendance, today, current?.id]);

  const mark = (student, status) => {
    const existing = data.attendance.find(
      (item) => item.studentId === student.id && item.date === today && item.sessionId === current?.id
    );

    const attendance = existing
      ? data.attendance.map((item) => item.id === existing.id ? { ...item, status } : item)
      : [...data.attendance, {
          id: Date.now() + Math.random(),
          studentId: student.id,
          sessionId: current?.id || null,
          date: today,
          status
        }];

    let next = { ...data, attendance };
    if (status === 'absent') next = queueAbsenceNotification(next, student, current, today);
    updateData(next);
  };

  const praise = (student, type) => {
    const phrase = encourageStudent(type, student.name, data.settings);
    setLastPraise(phrase);
  };

  if (!current) {
    return <section className="page class-mode-page"><div className="panel empty-state">
      <h2>لا توجد حصة حالية</h2>
      <p>حدد الحصة الحالية أولًا من قسم الحصص والمجموعات.</p>
      <button className="primary-btn" onClick={() => navigate('sessions')}>فتح الحصص</button>
    </div></section>;
  }

  return <section className="page class-mode-page">
    <div className="class-mode-header">
      <div>
        <span className="live-badge">● وضع الحصة</span>
        <h2>{current.title} — {current.group}</h2>
        <p>{current.day} • {formatTime12(current.time)} • {students.length} طالب</p>
      </div>
      <button className="secondary-btn" onClick={() => navigate('dashboard')}>إنهاء وضع الحصة</button>
    </div>

    {lastPraise && <div className="spoken-banner">🔊 {lastPraise}</div>}

    <div className="class-students-grid">
      {students.map((student) => {
        const status = attendanceMap[student.id];
        return <article className="class-student-card" key={student.id}>
          <header>
            <span className="student-code">{student.code}</span>
            <div><strong>{student.name}</strong><small>{student.grade}</small></div>
            <span className={`status-pill class-status ${status || ''}`}>{statusLabels[status] || 'لم يسجل'}</span>
          </header>

          <div className="class-attendance-actions">
            <button className={status === 'present' ? 'selected present-btn' : 'present-btn'} onClick={() => mark(student, 'present')}>حاضر</button>
            <button className={status === 'late' ? 'selected late-btn' : 'late-btn'} onClick={() => mark(student, 'late')}>متأخر</button>
            <button className={status === 'absent' ? 'selected absent-btn' : 'absent-btn'} onClick={() => mark(student, 'absent')}>غائب</button>
            <button className={status === 'excused' ? 'selected excused-btn' : 'excused-btn'} onClick={() => mark(student, 'excused')}>بعذر</button>
          </div>

          <div className="voice-shortcuts">
            <button onClick={() => praise(student, 'excellent')}>⭐ ممتاز</button>
            <button onClick={() => praise(student, 'close')}>🍬 ناقصها سكر</button>
            <button onClick={() => praise(student, 'retry')}>🔁 حاول تاني</button>
            <button onClick={() => praise(student, 'calm')}>🎯 ركّز</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
