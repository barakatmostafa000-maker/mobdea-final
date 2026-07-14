import { formatTime12 } from '../utils/time';
import { useState } from 'react';

export default function Sessions({ data, updateData }) {
  const [form, setForm] = useState(null);

  const save = () => {
    if (!form?.title?.trim() || !form?.group?.trim()) return;
    const exists = data.sessions.some((s) => s.id === form.id);
    let sessions = exists
      ? data.sessions.map((s) => s.id === form.id ? form : s)
      : [...data.sessions, { ...form, id: Date.now(), current: data.sessions.length === 0 }];
    updateData({ ...data, sessions });
    setForm(null);
  };

  const setCurrent = (id) => updateData({
    ...data,
    sessions: data.sessions.map((s) => ({ ...s, current: s.id === id }))
  });

  const remove = (id) => {
    const sessions = data.sessions.filter((s) => s.id !== id);
    if (sessions.length && !sessions.some((s) => s.current)) sessions[0] = { ...sessions[0], current: true };
    updateData({ ...data, sessions });
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><span className="eyebrow">تنظيم الجدول</span><h2>الحصص والمجموعات</h2><p>حدد حصة حالية لتظهر بيانات مجموعتها في الرئيسية والحضور.</p></div>
        <button className="primary-btn" onClick={() => setForm({ title: '', group: '', day: '', time: '17:00', price: 50 })}>+ إضافة حصة</button>
      </div>
      <div className="cards-list">
        {data.sessions.map((session) => (
          <article className={`panel session-item ${session.current ? 'current-item' : ''}`} key={session.id}>
            <div>
              <span className="eyebrow">{session.current ? '● الحصة الحالية' : 'حصة'}</span>
              <h3>{session.title}</h3>
              <p>{session.group} • {session.day} • {formatTime12(session.time)} • {session.price} ج</p>
            </div>
            <div className="row-actions">
              {!session.current && <button className="primary-btn" onClick={() => setCurrent(session.id)}>تعيين حالية</button>}
              <button className="secondary-btn" onClick={() => setForm({ ...session })}>تعديل</button>
              <button className="danger-btn" onClick={() => remove(session.id)}>حذف</button>
            </div>
          </article>
        ))}
        {!data.sessions.length && <div className="panel empty-state">لا توجد حصص بعد.</div>}
      </div>

      {form && <div className="modal-backdrop"><div className="modal-card">
        <h3>{form.id ? 'تعديل الحصة' : 'إضافة حصة'}</h3>
        <div className="form-grid">
          <input placeholder="الصف أو عنوان الحصة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="اسم المجموعة" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
          <input placeholder="اليوم" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <input type="number" placeholder="سعر الحصة" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </div>
        <div className="modal-actions"><button className="primary-btn" onClick={save}>حفظ</button><button className="secondary-btn" onClick={() => setForm(null)}>إلغاء</button></div>
      </div></div>}
    </section>
  );
}
