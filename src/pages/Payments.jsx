import { useState } from 'react';

export default function Payments({ data, updateData }) {
  const [form, setForm] = useState(null);
  const paid = data.payments.filter((p)=>p.type==='paid').reduce((n,p)=>n+p.amount,0);
  const due = data.payments.filter((p)=>p.type==='due').reduce((n,p)=>n+p.amount,0);

  const save = () => {
    if (!form?.studentId || !form?.amount) return;
    updateData({ ...data, payments: [...data.payments, { ...form, id: Date.now() }] });
    setForm(null);
  };

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">الدفع لكل حصة</span><h2>الحسابات والمستحقات</h2><p>تسجيل المدفوع والمستحق والخصم والإعفاء لكل طالب.</p></div><button className="primary-btn" onClick={()=>setForm({studentId:data.students[0]?.id||'',type:'paid',amount:50,note:'حصة',date:new Date().toISOString().slice(0,10)})}>+ تسجيل حركة</button></div>
    <div className="stats-grid compact"><div className="stat-card"><div><span>إجمالي المدفوع</span><strong>{paid} ج</strong><small>الحركات المدفوعة</small></div></div><div className="stat-card"><div><span>إجمالي المستحق</span><strong>{due} ج</strong><small>المبالغ المستحقة</small></div></div><div className="stat-card"><div><span>عدد الحركات</span><strong>{data.payments.length}</strong><small>كل الحركات</small></div></div></div>
    <div className="panel responsive-table"><table><thead><tr><th>الطالب</th><th>النوع</th><th>المبلغ</th><th>البيان</th><th>التاريخ</th></tr></thead><tbody>{[...data.payments].reverse().map((p)=><tr key={p.id}><td>{data.students.find((s)=>s.id===p.studentId)?.name||'—'}</td><td>{p.type==='paid'?'مدفوع':p.type==='due'?'مستحق':p.type}</td><td>{p.amount} ج</td><td>{p.note}</td><td>{p.date}</td></tr>)}</tbody></table></div>
    {form && <div className="modal-backdrop"><div className="modal-card"><h3>تسجيل حركة حساب</h3><div className="form-grid">
      <select value={form.studentId} onChange={(e)=>setForm({...form,studentId:Number(e.target.value)})}>{data.students.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option value="paid">مدفوع</option><option value="due">مستحق</option><option value="discount">خصم</option><option value="exempt">إعفاء</option></select>
      <input type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:Number(e.target.value)})}/>
      <input placeholder="البيان" value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})}/>
      <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/>
    </div><div className="modal-actions"><button className="primary-btn" onClick={save}>حفظ</button><button className="secondary-btn" onClick={()=>setForm(null)}>إلغاء</button></div></div></div>}
  </section>;
}
