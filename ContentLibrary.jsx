import { useMemo, useState } from 'react';
import { BookOpen, FileText, Image, Map, PlayCircle, Presentation, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';

const types = {
  video: ['فيديو', PlayCircle], pdf: ['PDF', FileText], image: ['صورة', Image], map: ['خريطة', Map], slides: ['عرض', Presentation], link: ['رابط', LinkIcon]
};

export default function ContentLibrary({ data, updateData }) {
  const [grade, setGrade] = useState('all');
  const [unit, setUnit] = useState('all');
  const [lesson, setLesson] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:'', grade:'الصف السادس الابتدائي', term:'الترم الأول', unit:'الوحدة الأولى', lesson:'الدرس الأول', type:'pdf', url:'', notes:'' });
  const items = data.contentLibrary || [];
  const grades = [...new Set(items.map(i=>i.grade).filter(Boolean))];
  const units = [...new Set(items.filter(i=>grade==='all'||i.grade===grade).map(i=>i.unit).filter(Boolean))];
  const lessons = [...new Set(items.filter(i=>(grade==='all'||i.grade===grade)&&(unit==='all'||i.unit===unit)).map(i=>i.lesson).filter(Boolean))];
  const filtered = useMemo(()=>items.filter(i=>(grade==='all'||i.grade===grade)&&(unit==='all'||i.unit===unit)&&(lesson==='all'||i.lesson===lesson)),[items,grade,unit,lesson]);

  const add = async () => {
    if (!form.title.trim() || !form.url.trim()) return;
    await updateData({ ...data, contentLibrary:[...items,{...form,id:Date.now(),createdAt:new Date().toISOString()}] });
    setForm({...form,title:'',url:'',notes:''}); setShowAdd(false);
  };
  const remove = id => updateData({ ...data, contentLibrary:items.filter(i=>i.id!==id) });

  return <section className="page content-page">
    <div className="page-heading"><div><span className="eyebrow">صفحة الشرح والمحتوى</span><h2>مكتبة المُبدع التعليمية</h2><p>فيديو وPDF وصور وخرائط وعروض وروابط مرتبة حسب الصف والوحدة والدرس.</p></div><button className="primary-btn" onClick={()=>setShowAdd(!showAdd)}><Plus size={18}/>إضافة محتوى</button></div>
    {showAdd && <article className="panel content-form">
      <input placeholder="عنوان المحتوى" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      <input placeholder="الصف" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}/>
      <input placeholder="الوحدة" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/>
      <input placeholder="الدرس" value={form.lesson} onChange={e=>setForm({...form,lesson:e.target.value})}/>
      <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(types).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}</select>
      <input placeholder="رابط الملف أو الفيديو" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/>
      <textarea placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
      <button className="primary-btn" onClick={add}>حفظ المحتوى</button>
    </article>}
    <div className="panel content-filters"><select value={grade} onChange={e=>{setGrade(e.target.value);setUnit('all');setLesson('all')}}><option value="all">كل الصفوف</option>{grades.map(v=><option key={v}>{v}</option>)}</select><select value={unit} onChange={e=>{setUnit(e.target.value);setLesson('all')}}><option value="all">كل الوحدات</option>{units.map(v=><option key={v}>{v}</option>)}</select><select value={lesson} onChange={e=>setLesson(e.target.value)}><option value="all">كل الدروس</option>{lessons.map(v=><option key={v}>{v}</option>)}</select></div>
    <div className="content-grid">{filtered.map(item=>{const [label,Icon]=types[item.type]||types.link;return <article className="content-card" key={item.id}><div className="content-icon"><Icon/></div><div><span>{label} • {item.grade}</span><h3>{item.title}</h3><p>{item.unit} — {item.lesson}</p><small>{item.notes}</small></div><div className="content-actions"><a href={item.url} target="_blank" rel="noreferrer">فتح</a><button onClick={()=>remove(item.id)}><Trash2 size={16}/></button></div></article>})}{!filtered.length&&<div className="panel empty-state"><BookOpen size={34}/><p>لا يوجد محتوى مطابق للفلترة.</p></div>}</div>
  </section>;
}
