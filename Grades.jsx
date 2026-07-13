import { useMemo, useState } from 'react';

export default function Grades({ data, updateData }) {
  const [form, setForm] = useState(null);
  const rows = useMemo(() => [...data.grades].sort((a,b) => b.date.localeCompare(a.date)), [data.grades]);

  const save = () => {
    if (!form?.studentId || !form?.exam?.trim() || !form?.total) return;
    updateData({ ...data, grades: [...data.grades, { ...form, id: Date.now() }] });
    setForm(null);
  };

  const avg = data.grades.length ? Math.round(data.grades.reduce((n,g)=>n+(g.score/g.total)*100,0)/data.grades.length) : 0;
  const needs = new Set(data.grades.filter((g)=>(g.score/g.total)*100 < 60).map((g)=>g.studentId)).size;

  return <section className="page">
    <div className="page-heading">
      <div><span className="eyebrow">التقييم والتحليل</span><h2>الدرجات والامتحانات</h2><p>الدرجة النهائية الافتراضية 20 مع تسجيل نقطة القوة والجزئية التي تحتاج مراجعة.</p></div>
      <button className="primary-btn" onClick={() => setForm({ studentId: data.students[0]?.id || '', exam: '', score: 0, total: 20, date: new Date().toISOString().slice(0,10), strength: '', weakness: '' })}>+ تسجيل نتيجة</button>
    </div>
    <div className="stats-grid compact">
      <div className="stat-card"><div><span>عدد النتائج</span><strong>{data.grades.length}</strong><small>كل الاختبارات</small></div></div>
      <div className="stat-card"><div><span>المتوسط العام</span><strong>{avg}%</strong><small>جميع النتائج</small></div></div>
      <div className="stat-card"><div><span>يحتاجون متابعة</span><strong>{needs}</strong><small>أقل من 60%</small></div></div>
    </div>
    <div className="panel responsive-table"><table><thead><tr><th>الطالب</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>القوة</th><th>يحتاج مراجعة</th><th>التاريخ</th></tr></thead>
      <tbody>{rows.map((g)=><tr key={g.id}><td>{data.students.find((s)=>s.id===g.studentId)?.name || '—'}</td><td>{g.exam}</td><td>{g.score}/{g.total}</td><td>{Math.round(g.score/g.total*100)}%</td><td>{g.strength || '—'}</td><td>{g.weakness || '—'}</td><td>{g.date}</td></tr>)}</tbody></table></div>
    {form && <div className="modal-backdrop"><div className="modal-card"><h3>تسجيل نتيجة</h3><div className="form-grid">
      <select value={form.studentId} onChange={(e)=>setForm({...form,studentId:Number(e.target.value)})}>{data.students.map((s)=><option value={s.id} key={s.id}>{s.name}</option>)}</select>
      <input placeholder="اسم الاختبار" value={form.exam} onChange={(e)=>setForm({...form,exam:e.target.value})}/>
      <input type="number" placeholder="درجة الطالب" value={form.score} onChange={(e)=>setForm({...form,score:Number(e.target.value)})}/>
      <input type="number" placeholder="الدرجة النهائية" value={form.total} onChange={(e)=>setForm({...form,total:Number(e.target.value)})}/>
      <input placeholder="نقطة القوة" value={form.strength} onChange={(e)=>setForm({...form,strength:e.target.value})}/>
      <input placeholder="الجزئية التي تحتاج مراجعة" value={form.weakness} onChange={(e)=>setForm({...form,weakness:e.target.value})}/>
      <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/>
    </div><div className="modal-actions"><button className="primary-btn" onClick={save}>حفظ</button><button className="secondary-btn" onClick={()=>setForm(null)}>إلغاء</button></div></div></div>}
  </section>;
}
