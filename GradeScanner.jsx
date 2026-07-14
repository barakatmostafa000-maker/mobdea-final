import { useMemo,useState } from 'react';
import { examQuestions } from '../data/questionBank';
import { queueLowGradeNotification } from '../services/notifications';
import { todayISO } from '../utils/time';
const cfg={correct:{label:'صحيح',factor:1},partial:{label:'جزئي',factor:.5},wrong:{label:'خطأ',factor:0},blank:{label:'لم يجب',factor:0}};
const codeOf=v=>{const m=String(v||'').match(/(\d+)/);return m?Number(m[1]):null};
export default function GradeScanner({data,updateData}){
 const [student,setStudent]=useState(null),[manual,setManual]=useState(''),[examId,setExamId]=useState(data.exams?.[0]?.id||''),[marks,setMarks]=useState({}),[saved,setSaved]=useState(false);
 const exam=data.exams.find(x=>x.id===examId), questions=useMemo(()=>examQuestions(exam),[exam]);
 const choose=()=>setStudent(data.students.find(s=>Number(s.code)===codeOf(manual))||null);
 const setMark=(id,status)=>setMarks(m=>({...m,[id]:status}));
 const detail=questions.map(q=>{const status=marks[q.id]||'blank';return {questionId:q.id,status,score:q.maxScore*cfg[status].factor,maxScore:q.maxScore,unit:q.unit,lesson:q.lesson,topic:q.topic,questionText:q.text}});
 const score=detail.reduce((a,b)=>a+b.score,0),total=detail.reduce((a,b)=>a+b.maxScore,0),pct=total?Math.round(score/total*100):0;
 const save=()=>{if(!student||!exam)return;const result={id:Date.now(),studentId:student.id,examId:exam.id,exam:exam.title,score,total,date:todayISO(),questionResults:detail};let next={...data,detailedResults:[...(data.detailedResults||[]),result],grades:[...data.grades,{id:result.id,studentId:student.id,exam:exam.title,score,total,date:result.date,strength:detail.filter(x=>x.status==='correct').map(x=>x.topic).slice(0,3).join('، '),weakness:detail.filter(x=>x.status!=='correct').map(x=>x.topic).slice(0,3).join('، ')}]};next=queueLowGradeNotification(next,student,exam.title,result);updateData(next);setSaved(true)};
 return <section className="page"><div className="page-heading"><div><span className="eyebrow">رصد سؤال بسؤال</span><h2>رصد الدرجات بالكود</h2><p>أدخل كود الطالب أو امسحه بالكاميرا داخل التطبيق، ثم حدد نتيجة كل سؤال.</p></div></div>
 <div className="scanner-summary-grid"><div className="panel"><h3>اختيار الطالب</h3>{student?<div className="selected-student"><span className="student-code large-code">{student.code}</span><div><h3>{student.name}</h3><p>{student.grade} — {student.group}</p></div></div>:<div className="manual-code"><input inputMode="numeric" placeholder="كود الطالب" value={manual} onChange={e=>setManual(e.target.value)}/><button className="primary-btn" onClick={choose}>اختيار</button></div>}</div><div className="panel result-live-card"><span>النتيجة الحالية</span><strong>{score}/{total}</strong><b className={pct<60?'low-percentage':'good-percentage'}>{pct}%</b></div></div>
 <div className="panel exam-picker-panel"><label>الامتحان</label><select value={examId} onChange={e=>setExamId(e.target.value)}>{data.exams.filter(x=>!student||x.grade===student.grade).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></div>
 <div className="question-marking-list">{questions.map((q,i)=><article className="panel marking-question" key={q.id}><header><span className="question-number">{i+1}</span><div><h3>{q.text}</h3><p>{q.unit} • {q.lesson} • <b>{q.topic}</b></p></div><span className="question-max">{q.maxScore} درجة</span></header><div className="marking-options">{Object.entries(cfg).map(([k,v])=><button key={k} className={(marks[q.id]||'blank')===k?`active ${k}`:k} onClick={()=>setMark(q.id,k)}>{v.label}</button>)}</div></article>)}</div>
 <div className="save-result-bar"><div><span>الإجمالي</span><strong>{score}/{total} — {pct}%</strong></div><button className="primary-btn" disabled={!student} onClick={save}>حفظ وتحليل الأخطاء</button></div>{saved&&<div className="success-result-banner">تم حفظ النتيجة وتجهيز التحليل والتنبيه عند أقل من 60%.</div>}</section>
}
