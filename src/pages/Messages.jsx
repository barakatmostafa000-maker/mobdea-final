import { useMemo, useState } from 'react';
import { cleanWhatsAppMessage, openWhatsApp } from '../services/whatsapp';
import { markNotification } from '../services/notifications';

const footer = `

مع خالص الشكر،
المُبدع مصطفى بركات
المُبدع لتعليم ممتع`;

export default function Messages({ data, updateData }) {
  const [studentId, setStudentId] = useState(data.students[0]?.id || '');
  const [type, setType] = useState('absence');
  const [selected, setSelected] = useState([]);
  const student = data.students.find((s)=>s.id===Number(studentId));

  const generated = useMemo(() => {
    if (!student) return '';
    const map = {
      absence: `السلام عليكم ورحمة الله وبركاته

عزيزي ولي الأمر،
نحيط سيادتكم علمًا بأن الطالب: ${student.name}
لم يحضر حصة اليوم. يرجى المتابعة.`,
      late: `السلام عليكم ورحمة الله وبركاته

عزيزي ولي الأمر،
نحيط سيادتكم علمًا بأن الطالب: ${student.name}
حضر متأخرًا إلى حصة اليوم.`,
      due: `السلام عليكم ورحمة الله وبركاته

نذكّر سيادتكم بوجود حصة مستحقة على الطالب: ${student.name}.`,
      praise: `السلام عليكم ورحمة الله وبركاته

يسعدنا إبلاغكم بأن الطالب: ${student.name}
قدم أداءً متميزًا في حصة اليوم. أحسنت يا بطل 🌟`
    };
    return cleanWhatsAppMessage((map[type] || '') + footer);
  }, [student, type]);

  const [custom, setCustom] = useState('');

  const sendQueued = (notification) => {
    openWhatsApp(notification.guardianPhone, notification.message);
    updateData(markNotification(data, notification.id, 'sent'));
  };

  const toggleStudent = (id) => setSelected((prev)=>prev.includes(id)?prev.filter((x)=>x!==id):[...prev,id]);
  const selectAll = () => setSelected(selected.length===data.students.length?[]:data.students.map((s)=>s.id));

  const sendBulk = () => {
    const targets=data.students.filter((s)=>selected.includes(s.id));
    targets.forEach((target,index)=>setTimeout(()=>openWhatsApp(target.guardianPhone,cleanWhatsAppMessage((type==='custom'?custom:generated).replace(student?.name||'',target.name))),index*700));
  };

  return <section className="page">
    <div className="page-heading"><div><span className="eyebrow">مركز رسائل أولياء الأمور</span><h2>الرسائل والتنبيهات</h2><p>الغياب يُضاف تلقائيًا إلى قائمة الرسائل الجاهزة، دون تكرار نفس الواقعة.</p></div></div>

    <div className="messages-layout">
      <div className="panel form-stack">
        <h3>إنشاء رسالة</h3>
        <select value={studentId} onChange={(e)=>setStudentId(e.target.value)}>{data.students.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={type} onChange={(e)=>setType(e.target.value)}><option value="absence">غياب</option><option value="late">تأخر</option><option value="due">مستحقات</option><option value="praise">تميز</option><option value="custom">رسالة مخصصة</option></select>
        <textarea value={type==='custom'?custom:generated} onChange={(e)=>setCustom(e.target.value)} rows="10"/>
        <button className="primary-btn" onClick={()=>student&&openWhatsApp(student.guardianPhone,type==='custom'?custom:generated)}>فتح واتساب</button>
      </div>

      <div className="panel">
        <div className="panel-title"><h3>الرسائل الجاهزة</h3><span className="status-pill">{(data.notifications||[]).filter((n)=>n.status==='ready').length}</span></div>
        {(data.notifications||[]).length ? [...data.notifications].reverse().map((item)=>{
          const target=data.students.find((s)=>s.id===item.studentId);
          return <div className="notification-row" key={item.id}><div><strong>{target?.name||'طالب'}</strong><small>{item.type==='absence'?'تنبيه غياب':item.type==='low-grade'?'نتيجة أقل من 60%':item.type} — {item.date}</small></div><span className={`notification-status ${item.status}`}>{item.status==='ready'?'جاهزة':item.status==='sent'?'تم الإرسال':item.status}</span>{item.status==='ready'&&<button className="whatsapp-btn" onClick={()=>sendQueued(item)}>إرسال</button>}</div>
        }):<div className="empty-state">لا توجد رسائل جاهزة.</div>}
      </div>
    </div>

    <div className="panel bulk-panel">
      <div className="panel-title"><h3>إرسال جماعي</h3><button className="secondary-btn" onClick={selectAll}>{selected.length===data.students.length?'إلغاء تحديد الكل':'تحديد الكل'}</button></div>
      <div className="bulk-students">{data.students.map((s)=><label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleStudent(s.id)}/><span>{s.name}</span><small>{s.group}</small></label>)}</div>
      <button className="primary-btn" disabled={!selected.length} onClick={sendBulk}>إرسال للمحددين ({selected.length})</button>
    </div>
  </section>;
}
