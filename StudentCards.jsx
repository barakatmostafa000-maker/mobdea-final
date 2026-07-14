import { useMemo, useState } from 'react';
import { Printer, Search, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentCards({ data }) {
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const groups = [...new Set(data.students.map((student) => student.group).filter(Boolean))];
  const students = useMemo(() => data.students.filter((student) =>
    (group === 'all' || student.group === group) &&
    (!query.trim() || student.name.includes(query.trim()) || String(student.code).includes(query.trim()))
  ), [data.students, group, query]);

  return <section className="page student-cards-page">
    <div className="page-heading no-print">
      <div><span className="eyebrow">A3 — وجه واحد</span><h2>كروت طلاب المُبدع</h2><p>كروت سوداء وذهبية بهوية المُبدع، QR واضح، ومنع انقسام الكارت عند الطباعة.</p></div>
      <button className="primary-btn icon-button" onClick={()=>window.print()}><Printer size={18}/> طباعة الكروت</button>
    </div>

    <div className="panel card-print-controls no-print">
      <label><span>المجموعة</span><select value={group} onChange={(event)=>setGroup(event.target.value)}><option value="all">كل المجموعات</option>{groups.map((item)=><option key={item}>{item}</option>)}</select></label>
      <label className="card-search"><Search size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="ابحث بالاسم أو الكود"/></label>
      <div className="print-note"><ShieldCheck size={18}/><span>مقاس A3 أفقي — الكارت لا ينقسم بين الصفحات</span></div>
    </div>

    <div className="student-cards-grid">
      {students.map((student) => <article className="print-student-card" key={student.id}>
        <div className="card-gold-orbit" />
        <header className="premium-card-header">
          <img src="/identity/mostafa-barakat.jpg" alt="المُبدع مصطفى بركات" />
          <div><strong>المُبدع مصطفى بركات</strong><span>معلّم تاريخ ودراسات</span></div>
          <b>2027</b>
        </header>
        <div className="premium-card-body">
          <div className="card-info">
            <span className="card-label">اسم الطالب</span>
            <h3>{student.name}</h3>
            <p>{student.grade}</p>
            <p>{student.group}</p>
            <div className="short-code"><span>كود الطالب</span><b>{student.code}</b></div>
          </div>
          <div className="card-qr"><QRCodeSVG value={`mobdea://student/${student.code}`} size={112} level="H" includeMargin /></div>
        </div>
        <footer><span>المُبدع لتعليم ممتع</span><small>هذا الكارت خاص بمنصة المُبدع</small></footer>
      </article>)}
      {!students.length && <div className="panel empty-state no-print">لا توجد كروت مطابقة للبحث.</div>}
    </div>
  </section>;
}
