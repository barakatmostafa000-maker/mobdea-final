import { useMemo, useState } from 'react';
import { ContactRound, Trash2 } from 'lucide-react';
import { normalizeEgyptPhone, pickPhoneFromContacts } from '../services/contacts';

function pruneStudentFromData(data, studentId) {
  return {
    ...data,
    students: data.students.filter((student) => student.id !== studentId),
    attendance: (data.attendance || []).filter((item) => item.studentId !== studentId),
    grades: (data.grades || []).filter((item) => item.studentId !== studentId),
    detailedResults: (data.detailedResults || []).filter((item) => item.studentId !== studentId),
    payments: (data.payments || []).filter((item) => item.studentId !== studentId),
    gameResults: (data.gameResults || []).filter((item) => item.studentId !== studentId && item.secondStudentId !== studentId),
    notifications: (data.notifications || []).filter((item) => item.studentId !== studentId),
    achievements: (data.achievements || []).filter((item) => item.studentId !== studentId),
  };
}

export default function Students({ data, updateData }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [contactMessage, setContactMessage] = useState('');

  const filtered = useMemo(() => data.students.filter((s) =>
    !search || s.name.includes(search) || String(s.code).includes(search)
  ), [data.students, search]);

  const chooseContact = async (field) => {
    try {
      const result = await pickPhoneFromContacts();
      if (!result.supported) { setContactMessage('اختيار جهات الاتصال غير مدعوم على هذا الجهاز؛ اكتب الرقم يدويًا.'); return; }
      const phone = normalizeEgyptPhone(result.phone);
      if (!phone) return;
      const duplicate = data.students.find((student) => student.id !== form?.id && (student.guardianPhone === phone || student.studentPhone === phone));
      if (duplicate) setContactMessage(`تنبيه: الرقم مستخدم لدى ${duplicate.name}`);
      setForm((previous) => ({ ...previous, [field]: phone }));
    } catch { setContactMessage('تعذر فتح جهات الاتصال. تحقق من الإذن.'); }
  };

  const save = () => {
    if (!form?.name?.trim()) return;
    const exists = data.students.some((s) => s.id === form.id);
    const next = exists
      ? data.students.map((s) => s.id === form.id ? form : s)
      : [...data.students, { ...form, id: Date.now(), code: Math.max(0, ...data.students.map((s) => Number(s.code) || 0)) + 1 }];
    updateData({ ...data, students: next });
    setForm(null);
  };

  const remove = (student) => {
    if (!window.confirm(`حذف الطالب ${student.name} نهائيًا؟ سيتم حذف بياناته المرتبطة فقط دون التأثير على بقية الطلاب.`)) return;
    updateData(pruneStudentFromData(data, student.id));
    if (form?.id === student.id) setForm(null);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><span className="eyebrow">إدارة الطلاب</span><h2>الطلاب والمجموعات</h2></div>
        <button className="primary-btn" onClick={() => setForm({ name: '', grade: '', group: '', guardianPhone: '', studentPhone: '', sessionPrice: 50, permissions:{games:true,grades:true,content:true}, parentPermissions:{attendance:true,grades:true,dues:true} })}>+ إضافة طالب</button>
      </div>

      <div className="panel">
        <input className="search-input" placeholder="بحث بالاسم أو الكود..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="responsive-table">
          <table>
            <thead><tr><th>الكود</th><th>الاسم</th><th>الصف</th><th>المجموعة</th><th>ولي الأمر</th><th></th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td><span className="student-code">{student.code}</span></td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.grade}</td>
                  <td>{student.group}</td>
                  <td>{student.guardianPhone}</td>
                  <td style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button className="text-btn" onClick={() => setForm({ ...student })}>تعديل</button>
                    <button className="text-btn danger-text" onClick={() => remove(student)}><Trash2 size={16} /> حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{form.id ? 'تعديل طالب' : 'إضافة طالب'}</h3>
            <div className="form-grid">
              <input placeholder="اسم الطالب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="الصف الدراسي" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
              <input placeholder="المجموعة" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
              <div className="phone-picker-field"><input placeholder="رقم ولي الأمر" value={form.guardianPhone || ''} onChange={(e) => setForm({ ...form, guardianPhone: normalizeEgyptPhone(e.target.value) })} /><button type="button" onClick={() => chooseContact('guardianPhone')} title="اختيار من جهات الاتصال"><ContactRound/></button></div>
              <div className="phone-picker-field"><input placeholder="رقم الطالب" value={form.studentPhone || ''} onChange={(e) => setForm({ ...form, studentPhone: normalizeEgyptPhone(e.target.value) })} /><button type="button" onClick={() => chooseContact('studentPhone')} title="اختيار من جهات الاتصال"><ContactRound/></button></div>
              {contactMessage && <div className="contact-message">{contactMessage}</div>}
              <input type="number" placeholder="سعر الحصة" value={form.sessionPrice} onChange={(e) => setForm({ ...form, sessionPrice: Number(e.target.value) })} />
              <label className="permission-check"><input type="checkbox" checked={form.permissions?.games !== false} onChange={(e)=>setForm({...form,permissions:{...form.permissions,games:e.target.checked}})}/> السماح بالألعاب</label>
              <label className="permission-check"><input type="checkbox" checked={form.permissions?.grades !== false} onChange={(e)=>setForm({...form,permissions:{...form.permissions,grades:e.target.checked}})}/> إظهار الدرجات للطالب</label>
              <label className="permission-check"><input type="checkbox" checked={form.parentPermissions?.grades !== false} onChange={(e)=>setForm({...form,parentPermissions:{...form.parentPermissions,grades:e.target.checked}})}/> إظهار الدرجات لولي الأمر</label>
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={save}>حفظ</button>
              <button className="secondary-btn" onClick={() => setForm(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
