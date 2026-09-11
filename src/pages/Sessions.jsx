// PROJECT13_SOCIAL_LESSON_LINKS_V1
import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Link2 } from 'lucide-react';
import Project13LinkHub from '../components/links/Project13LinkHub';
import { formatTime12 } from '../utils/time';

export default function Sessions({ data, updateData }) {
  const [form, setForm] = useState(null);
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const lessons = useMemo(
    () => (data.contentLibrary || []).filter((item) => item.type === 'lesson')
      .sort((a, b) => String(b.lessonDate || b.updatedAt || '').localeCompare(String(a.lessonDate || a.updatedAt || ''))),
    [data.contentLibrary],
  );

  const save = async () => {
    if (!form?.title?.trim() || !form?.group?.trim()) return;
    const exists = sessions.some((session) => String(session.id) === String(form.id));
    const nextSessions = exists
      ? sessions.map((session) => String(session.id) === String(form.id) ? form : session)
      : [...sessions, { ...form, id: Date.now(), current: sessions.length === 0 }];
    await updateData({ ...data, sessions: nextSessions });
    setForm(null);
  };

  const setCurrent = (id) => updateData({
    ...data,
    sessions: sessions.map((session) => ({ ...session, current: String(session.id) === String(id) })),
  });

  const remove = (id) => {
    const next = sessions.filter((session) => String(session.id) !== String(id));
    if (next.length && !next.some((session) => session.current)) next[0] = { ...next[0], current: true };
    return updateData({ ...data, sessions: next });
  };

  return (
    <section className="page project13-sessions-links-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">الجدول والروابط</span>
          <h2>الحصص وروابط المحتوى</h2>
          <p>لا توجد قائمة تسجيلات فيديو. هنا جدول الحصص وروابط صفحاتك وروابط الدروس فقط.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setForm({ title: '', group: '', day: '', time: '17:00', price: 50 })}>+ إضافة حصة</button>
      </div>

      <div className="project13-sessions-layout">
        <section className="project13-session-list">
          <div className="section-heading compact"><div><span className="eyebrow">الجدول</span><h3>الحصص والمجموعات</h3></div><CalendarDays size={20}/></div>
          <div className="cards-list">
            {sessions.map((session) => (
              <article className={`panel session-item ${session.current ? 'current-item' : ''}`} key={session.id}>
                <div><span className="eyebrow">{session.current ? '● الحصة الحالية' : 'حصة'}</span><h3>{session.title}</h3><p>{session.group} • {session.day} • {formatTime12(session.time)} • {session.price} ج</p></div>
                <div className="row-actions">
                  {!session.current && <button className="primary-btn" type="button" onClick={() => void setCurrent(session.id)}>تعيين حالية</button>}
                  <button className="secondary-btn" type="button" onClick={() => setForm({ ...session })}>تعديل</button>
                  <button className="danger-btn" type="button" onClick={() => void remove(session.id)}>حذف</button>
                </div>
              </article>
            ))}
            {!sessions.length && <div className="panel empty-state">لا توجد حصص بعد.</div>}
          </div>
        </section>

        <aside className="project13-links-column">
          <Project13LinkHub settings={data.settings}/>
          <article className="panel">
            <div className="panel-heading compact"><div><span className="eyebrow">رابط مستقل لكل درس</span><h3>روابط الدروس</h3></div><Link2 size={18}/></div>
            <div className="project13-lesson-links">
              {lessons.filter((lesson) => lesson.lessonLink).map((lesson) => (
                <a key={lesson.id} href={lesson.lessonLink} target="_blank" rel="noopener noreferrer">
                  <span><strong>{lesson.title}</strong><small>{lesson.grade} • {lesson.unit}</small></span><ExternalLink size={15}/>
                </a>
              ))}
              {!lessons.some((lesson) => lesson.lessonLink) && <small className="settings-help">أضف رابط الدرس من شاشة تعديل الدرس في المكتبة.</small>}
            </div>
          </article>
        </aside>
      </div>

      {form && (
        <div className="modal-backdrop"><div className="modal-card">
          <h3>{form.id ? 'تعديل الحصة' : 'إضافة حصة'}</h3>
          <div className="form-grid">
            <input placeholder="الصف أو عنوان الحصة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/>
            <input placeholder="اسم المجموعة" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}/>
            <input placeholder="اليوم" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}/>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}/>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}/>
          </div>
          <div className="modal-actions"><button className="primary-btn" type="button" onClick={() => void save()}>حفظ</button><button className="secondary-btn" type="button" onClick={() => setForm(null)}>إلغاء</button></div>
        </div></div>
      )}
    </section>
  );
}
