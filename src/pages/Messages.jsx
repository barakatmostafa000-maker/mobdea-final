import { useMemo, useState } from 'react';
import { CheckCheck, Filter, MessageCircle, Search, Send, UsersRound } from 'lucide-react';
import { cleanWhatsAppMessage, openWhatsApp } from '../services/whatsapp';
import { markNotification } from '../services/notifications';

const footer = `\n\nمع خالص الشكر،\nالمُبدع مصطفى بركات\nالمُبدع لتعليم ممتع`;
const statusLabel = { ready:'جاهزة', sent:'تم الإرسال', failed:'فشل', postponed:'مؤجلة', cancelled:'ألغيت' };

export default function Messages({ data, updateData }) {
  const [studentId, setStudentId] = useState(data.students[0]?.id || '');
  const [type, setType] = useState('absence');
  const [custom, setCustom] = useState('');
  const [selected, setSelected] = useState([]);
  const [group, setGroup] = useState('all');
  const [audience, setAudience] = useState('manual');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const student = data.students.find((item)=>item.id===Number(studentId));
  const groups = [...new Set(data.students.map((item)=>item.group).filter(Boolean))];

  const generated = useMemo(() => {
    if (!student) return '';
    const map = {
      absence:`السلام عليكم ورحمة الله وبركاته\n\nعزيزي ولي الأمر،\nنحيط سيادتكم علمًا بأن الطالب: ${student.name}\nلم يحضر حصة اليوم. يرجى المتابعة.`,
      late:`السلام عليكم ورحمة الله وبركاته\n\nعزيزي ولي الأمر،\nالطالب: ${student.name}\nحضر متأخرًا إلى حصة اليوم.`,
      due:`السلام عليكم ورحمة الله وبركاته\n\nنذكّر سيادتكم بوجود حصة مستحقة على الطالب: ${student.name}.`,
      praise:`السلام عليكم ورحمة الله وبركاته\n\nيسعدنا إبلاغكم بأن الطالب: ${student.name}\nقدم أداءً متميزًا في حصة اليوم. أحسنت يا بطل 🌟`,
      followup:`السلام عليكم ورحمة الله وبركاته\n\nنرجو متابعة مستوى الطالب: ${student.name}\nوالتواصل معنا لتحديد نقاط التحسين المطلوبة.`
    };
    return cleanWhatsAppMessage((map[type] || '') + footer);
  }, [student, type]);

  const eligible = useMemo(() => data.students.filter((item) => {
    if (group !== 'all' && item.group !== group) return false;
    if (search.trim() && !item.name.includes(search.trim()) && !String(item.code).includes(search.trim())) return false;
    if (audience === 'absent') return data.attendance.some((entry)=>entry.studentId===item.id && entry.status==='absent');
    if (audience === 'low') {
      const grades=data.grades.filter((entry)=>entry.studentId===item.id);
      return grades.some((entry)=>(entry.score/entry.total)*100<60);
    }
    if (audience === 'due') return data.payments.some((entry)=>entry.studentId===item.id && entry.type==='due');
    return true;
  }), [data, group, search, audience]);

  const queue = useMemo(() => [...(data.notifications||[])].reverse().filter((item)=>statusFilter==='all'||item.status===statusFilter), [data.notifications,statusFilter]);
  const toggleStudent=(id)=>setSelected((previous)=>previous.includes(id)?previous.filter((item)=>item!==id):[...previous,id]);
  const selectEligible=()=>setSelected(eligible.map((item)=>item.id));

  const sendQueued=(notification)=>{
    openWhatsApp(notification.guardianPhone,notification.message);
    updateData(markNotification(data,notification.id,'sent'));
  };
  const changeQueueStatus=(id,status)=>updateData(markNotification(data,id,status));
  const sendBulk=()=>{
    const targets=data.students.filter((item)=>selected.includes(item.id));
    targets.forEach((target,index)=>setTimeout(()=>{
      const message=(type==='custom'?custom:generated).replace(student?.name||'',target.name);
      openWhatsApp(target.guardianPhone,cleanWhatsAppMessage(message));
    },index*850));
  };

  return <section className="page messages-pro-page">
    <div className="page-heading"><div><span className="eyebrow">مركز التواصل</span><h2>رسائل أولياء الأمور</h2><p>إنشاء، فلترة، إرسال جماعي، وسجل حالة لكل رسالة دون تكرار نفس الواقعة.</p></div><div className="messages-kpi"><MessageCircle/><span><strong>{(data.notifications||[]).filter((item)=>item.status==='ready').length}</strong><small>جاهزة للإرسال</small></span></div></div>

    <div className="messages-layout">
      <div className="panel form-stack message-composer">
        <h3>إنشاء رسالة</h3>
        <select value={studentId} onChange={(event)=>setStudentId(event.target.value)}>{data.students.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={type} onChange={(event)=>setType(event.target.value)}><option value="absence">غياب</option><option value="late">تأخر</option><option value="due">مستحقات</option><option value="praise">تميز</option><option value="followup">متابعة مستوى</option><option value="custom">رسالة مخصصة</option></select>
        <textarea value={type==='custom'?custom:generated} onChange={(event)=>setCustom(event.target.value)} rows="10"/>
        <button className="primary-btn icon-button" onClick={()=>student&&openWhatsApp(student.guardianPhone,type==='custom'?custom:generated)}><Send size={17}/> فتح واتساب</button>
      </div>

      <div className="panel queue-panel">
        <div className="panel-title"><h3>سجل الرسائل</h3><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option value="all">كل الحالات</option><option value="ready">جاهزة</option><option value="sent">تم الإرسال</option><option value="failed">فشل</option><option value="postponed">مؤجلة</option></select></div>
        {queue.length?queue.map((item)=>{const target=data.students.find((entry)=>entry.id===item.studentId);return <div className="notification-row notification-row-pro" key={item.id}><div><strong>{target?.name||'طالب'}</strong><small>{item.type==='absence'?'تنبيه غياب':item.type==='low-grade'?'نتيجة أقل من 60%':item.type} — {item.date}</small></div><span className={`notification-status ${item.status}`}>{statusLabel[item.status]||item.status}</span><div className="queue-actions">{item.status==='ready'&&<button className="whatsapp-btn" onClick={()=>sendQueued(item)}>إرسال</button>}<button onClick={()=>changeQueueStatus(item.id,item.status==='postponed'?'ready':'postponed')}>{item.status==='postponed'?'إعادة':'تأجيل'}</button></div></div>}):<div className="empty-state">لا توجد رسائل بهذه الحالة.</div>}
      </div>
    </div>

    <div className="panel bulk-panel">
      <div className="panel-title"><div><h3>إرسال جماعي ذكي</h3><small>اختر الجميع أو فئة محددة أو أشخاصًا يدويًا</small></div><UsersRound size={22}/></div>
      <div className="bulk-filter-grid"><label><Filter size={16}/><select value={audience} onChange={(event)=>setAudience(event.target.value)}><option value="manual">كل الطلاب / يدوي</option><option value="absent">الغائبون فقط</option><option value="low">أقل من 60%</option><option value="due">عليهم مستحقات</option></select></label><select value={group} onChange={(event)=>setGroup(event.target.value)}><option value="all">كل المجموعات</option>{groups.map((item)=><option key={item}>{item}</option>)}</select><label className="bulk-search"><Search size={16}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود"/></label></div>
      <div className="bulk-toolbar"><button className="secondary-btn" onClick={selectEligible}><CheckCheck size={17}/> تحديد الظاهر ({eligible.length})</button><button className="secondary-btn" onClick={()=>setSelected([])}>إلغاء التحديد</button></div>
      <div className="bulk-students">{eligible.map((item)=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggleStudent(item.id)}/><span>{item.name}</span><small>{item.group}</small></label>)}</div>
      <button className="primary-btn icon-button" disabled={!selected.length} onClick={sendBulk}><Send size={17}/> إرسال للمحددين ({selected.length})</button>
    </div>
  </section>;
}
