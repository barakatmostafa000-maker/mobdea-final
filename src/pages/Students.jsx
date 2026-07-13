import { useMemo, useState } from 'react';

export default function Students({ data, updateData }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);

  const filtered = useMemo(() => data.students.filter((s) =>
    !search || s.name.includes(search) || String(s.code).includes(search)
  ), [data.students, search]);

  const save = () => {
    if (!form?.name?.trim()) return;
    const exists = data.students.some((s) => s.id === form.id);
    const next = exists
      ? data.students.map((s) => s.id === form.id ? form : s)
      : [...data.students, { ...form, id: Date.now(), code: Math.max(0, ...data.students.map((s) => Number(s.code) || 0)) + 1 }];
    updateData({ ...data, students: next });
    setForm(null);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><span className="eyebrow">إدارة الطلاب</span><h2>الطلاب والمجموعات</h2></div>
        <button className="primary-btn" onClick={() => setForm({ name: '', grade: '', group: '', guardianPhone: '', sessionPrice: 50, permissions:{games:true,grades:true,content:true}, parentPermissions:{attendance:true,grades:true,dues:true} })}>+ إضافة طالب</button>
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
                  <td><button className="text-btn" onClick={() => setForm({ ...student })}>تعديل</button></td>
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
              <input placeholder="رقم ولي الأمر" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
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
