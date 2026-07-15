import { useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, BookOpenCheck, MessageCircle, Sparkles, UserRoundCheck } from 'lucide-react';
import { buildSmartInsights, studentAnalytics } from '../services/insights';
import { openWhatsApp } from '../services/whatsapp';

const labels = { danger: 'عاجل', warning: 'تنبيه', info: 'اقتراح' };

export default function SmartAssistant({ data }) {
  const [filter, setFilter] = useState('all');
  const insights = useMemo(() => buildSmartInsights(data), [data]);
  const visible = filter === 'all' ? insights : insights.filter((item) => item.type === filter);
  const strongStudents = useMemo(() => (data.students || []).map((student) => ({ student, stats: studentAnalytics(data, student) }))
    .filter((item) => item.stats.avg !== null)
    .sort((a, b) => b.stats.avg - a.stats.avg).slice(0, 5), [data]);

  const contact = (item) => {
    const student = data.students.find((entry) => entry.id === item.studentId);
    if (!student) return;
    openWhatsApp(student.guardianPhone, `السلام عليكم ورحمة الله وبركاته\n\nنود متابعة الطالب: ${student.name}\n${item.body}\n\n${item.action}\n\nالمُبدع مصطفى بركات\nالمُبدع لتعليم ممتع`);
  };

  return <section className="page smart-assistant-page">
    <div className="page-heading">
      <div><span className="eyebrow">تحليل محلي ذكي</span><h2>مساعد المُبدع</h2><p>يحوّل الحضور والدرجات والمستحقات إلى قرارات عملية قابلة للتنفيذ.</p></div>
      <div className="assistant-badge"><BrainCircuit size={22}/><span><strong>{insights.length}</strong><small>ملاحظة ذكية</small></span></div>
    </div>

    <div className="assistant-filter-bar">
      {[['all','الكل'],['grade','الدرجات'],['attendance','الحضور'],['payment','المستحقات'],['lesson','الدروس']].map(([key,label]) => <button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}
    </div>

    <div className="assistant-layout">
      <div className="assistant-insights-list">
        {visible.length ? visible.map((item) => <article className={`assistant-insight ${item.level}`} key={item.id}>
          <div className="assistant-icon">{item.level==='danger'?<AlertTriangle/>:item.type==='lesson'?<BookOpenCheck/>:<Sparkles/>}</div>
          <div className="assistant-copy"><span>{labels[item.level]}</span><h3>{item.title}</h3><p>{item.body}</p><strong>{item.action}</strong></div>
          {item.studentId && <button className="whatsapp-btn" onClick={()=>contact(item)}><MessageCircle size={17}/> تواصل</button>}
        </article>) : <div className="panel empty-state">لا توجد ملاحظات في هذا التصنيف.</div>}
      </div>

      <aside className="panel assistant-top-students">
        <div className="panel-title"><h3>أفضل أداء حاليًا</h3><UserRoundCheck size={20}/></div>
        {strongStudents.map(({student,stats},index)=><div className="assistant-rank" key={student.id}><b>{index+1}</b><div><strong>{student.name}</strong><small>{student.group}</small></div><span>{stats.avg}%</span></div>)}
        {!strongStudents.length && <div className="empty-state">لا توجد درجات كافية للتحليل.</div>}
      </aside>
    </div>
  </section>;
}
