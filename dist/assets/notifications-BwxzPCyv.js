import{c as f,b as m}from"./whatsapp-CcIGOCJ8.js";function u(e,t,a,n){const o=`absence:${t.id}:${(a==null?void 0:a.id)||"none"}:${n}`;if((e.notifications||[]).some(r=>r.eventKey===o))return e;const c={id:Date.now()+Math.random(),eventKey:o,type:"absence",studentId:t.id,guardianPhone:t.guardianPhone,sessionId:(a==null?void 0:a.id)||null,date:n,status:"ready",createdAt:new Date().toISOString(),message:f(m(t.name,"absent",n))};return{...e,notifications:[...e.notifications||[],c]}}function $(e,t,a){return{...e,notifications:(e.notifications||[]).map(n=>n.id===t?{...n,status:a,updatedAt:new Date().toISOString()}:n)}}function p(e,t,a,n){const o=Math.round(n.score/Math.max(1,n.total)*100);if(o>=60)return e;const c=`low-grade:${t.id}:${n.examId}:${n.id}`;if((e.notifications||[]).some(i=>i.eventKey===c))return e;const r=[...new Set(n.questionResults.filter(i=>i.status!=="correct").map(i=>i.topic).filter(Boolean))],d=`السلام عليكم ورحمة الله وبركاته

عزيزي ولي الأمر،
نتيجة الطالب: ${t.name}
في اختبار: ${a}
الدرجة: ${n.score}/${n.total}
النسبة: ${o}%

الموضوعات التي تحتاج مراجعة:
${r.map(i=>`- ${i}`).join(`
`)||"- مراجعة أسئلة الاختبار"}

المُبدع مصطفى بركات
المُبدع لتعليم ممتع`;return{...e,notifications:[...e.notifications||[],{id:Date.now()+Math.random(),eventKey:c,type:"low-grade",studentId:t.id,guardianPhone:t.guardianPhone,examId:n.examId,date:n.date,status:"ready",createdAt:new Date().toISOString(),message:d}]}}export{p as a,$ as m,u as q};
