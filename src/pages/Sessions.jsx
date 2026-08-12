import { useMemo, useState } from 'react';
import { Archive, CalendarDays, Video } from 'lucide-react';
import LessonRecordingItem from '../components/classmode/LessonRecordingItem';
import { formatTime12 } from '../utils/time';

export default function Sessions({ data, updateData }) {
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const recordings = useMemo(
    () => [...(Array.isArray(data.lessonRecordings) ? data.lessonRecordings : [])]
      .sort((a, b) => Number(new Date(b.createdAt || b.updatedAt || 0)) - Number(new Date(a.createdAt || a.updatedAt || 0))),
    [data.lessonRecordings],
  );

  const save = () => {
    if (!form?.title?.trim() || !form?.group?.trim()) return;
    const exists = sessions.some((session) => session.id === form.id);
    const nextSessions = exists
      ? sessions.map((session) => session.id === form.id ? form : session)
      : [...sessions, { ...form, id: Date.now(), current: sessions.length === 0 }];
    updateData({ ...data, sessions: nextSessions });
    setForm(null);
  };

  const setCurrent = (id) => updateData({
    ...data,
    sessions: sessions.map((session) => ({ ...session, current: session.id === id })),
  });

  const remove = (id) => {
    const nextSessions = sessions.filter((session) => session.id !== id);
    if (nextSessions.length && !nextSessions.some((session) => session.current)) {
      nextSessions[0] = { ...nextSessions[0], current: true };
    }
    updateData({ ...data, sessions: nextSessions });
  };

  return (
    <section className="page sessions-recordings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">تنظيم الجدول والتوثيق</span>
          <h2>الحصص وقائمة التسجيلات</h2>
          <p>كل تسجيل يتم إنهاؤه من وضع الحصة يُحفظ هنا تلقائيًا، مع الفيديو أو سجل سير الحصة البديل.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setForm({ title: '', group: '', day: '', time: '17:00', price: 50 })}>+ إضافة حصة</button>
      </div>

      {notice && <div className="settings-notice success">{notice}</div>}

      <div className="sessions-recordings-stats">
        <div className="panel"><CalendarDays size={22} /><div><strong>{sessions.length}</strong><span>حصة ومجموعة</span></div></div>
        <div className="panel"><Video size={22} /><div><strong>{recordings.filter((item) => item.videoAssetId || item.videoUrl).length}</strong><span>تسجيل فيديو</span></div></div>
        <div className="panel"><Archive size={22} /><div><strong>{recordings.length}</strong><span>إجمالي التسجيلات</span></div></div>
      </div>

      <div className="sessions-recordings-layout">
        <section className="sessions-schedule-column">
          <div className="section-heading compact"><div><span className="eyebrow">الجدول</span><h3>الحصص والمجموعات</h3></div></div>
          <div className="cards-list">
            {sessions.map((session) => (
              <article className={`panel session-item ${session.current ? 'current-item' : ''}`} key={session.id}>
                <div>
                  <span className="eyebrow">{session.current ? '● الحصة الحالية' : 'حصة'}</span>
                  <h3>{session.title}</h3>
                  <p>{session.group} • {session.day} • {formatTime12(session.time)} • {session.price} ج</p>
                </div>
                <div className="row-actions">
                  {!session.current && <button className="primary-btn" type="button" onClick={() => setCurrent(session.id)}>تعيين حالية</button>}
                  <button className="secondary-btn" type="button" onClick={() => setForm({ ...session })}>تعديل</button>
                  <button className="danger-btn" type="button" onClick={() => remove(session.id)}>حذف</button>
                </div>
              </article>
            ))}
            {!sessions.length && <div className="panel empty-state">لا توجد حصص بعد.</div>}
          </div>
        </section>

        <section className="sessions-recordings-column panel">
          <div className="section-heading compact">
            <div><span className="eyebrow">الأرشيف المرئي</span><h3>قائمة التسجيلات</h3></div>
            <Video size={20} />
          </div>
          <div className="sessions-recordings-list">
            {recordings.length ? recordings.map((recording) => (
              <LessonRecordingItem key={recording.id} recording={recording} onNotice={setNotice} />
            )) : (
              <div className="empty-state compact-empty">
                <Video size={30} />
                <strong>لا توجد تسجيلات محفوظة بعد</strong>
                <span>ابدأ التسجيل من وضع الحصة، ثم اضغط إيقاف التسجيل ليظهر هنا مباشرة.</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{form.id ? 'تعديل الحصة' : 'إضافة حصة'}</h3>
            <div className="form-grid">
              <input placeholder="الصف أو عنوان الحصة" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              <input placeholder="اسم المجموعة" value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} />
              <input placeholder="اليوم" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })} />
              <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
              <input type="number" placeholder="سعر الحصة" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
            </div>
            <div className="modal-actions">
              <button className="primary-btn" type="button" onClick={save}>حفظ</button>
              <button className="secondary-btn" type="button" onClick={() => setForm(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
