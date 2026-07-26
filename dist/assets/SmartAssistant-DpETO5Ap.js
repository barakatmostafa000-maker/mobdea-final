import{c as o,r as c,j as s,m as x,S as j,M as m}from"./index-CtdBHunI.js";import{b as g,s as u}from"./insights-MyWFeugt.js";import{o as v}from"./whatsapp-CcIGOCJ8.js";import{B as N}from"./book-open-check-VbzH36aW.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=o("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=o("UserRoundCheck",[["path",{d:"M2 21a8 8 0 0 1 13.292-6",key:"bjp14o"}],["circle",{cx:"10",cy:"8",r:"5",key:"o932ke"}],["path",{d:"m16 19 2 2 4-4",key:"1b14m6"}]]),f={danger:"عاجل",warning:"تنبيه",info:"اقتراح"};function S({data:n}){const[t,h]=c.useState("all"),l=c.useMemo(()=>g(n),[n]),r=t==="all"?l:l.filter(e=>e.type===t),d=c.useMemo(()=>(n.students||[]).map(e=>({student:e,stats:u(n,e)})).filter(e=>e.stats.avg!==null).sort((e,a)=>a.stats.avg-e.stats.avg).slice(0,5),[n]),p=e=>{const a=n.students.find(i=>i.id===e.studentId);a&&v(a.guardianPhone,`السلام عليكم ورحمة الله وبركاته

نود متابعة الطالب: ${a.name}
${e.body}

${e.action}

المُبدع مصطفى بركات
المُبدع لتعليم ممتع`)};return s.jsxs("section",{className:"page smart-assistant-page",children:[s.jsxs("div",{className:"page-heading",children:[s.jsxs("div",{children:[s.jsx("span",{className:"eyebrow",children:"تحليل محلي ذكي"}),s.jsx("h2",{children:"مساعد المُبدع"}),s.jsx("p",{children:"يحوّل الحضور والدرجات والمستحقات إلى قرارات عملية قابلة للتنفيذ."})]}),s.jsxs("div",{className:"assistant-badge",children:[s.jsx(x,{size:22}),s.jsxs("span",{children:[s.jsx("strong",{children:l.length}),s.jsx("small",{children:"ملاحظة ذكية"})]})]})]}),s.jsx("div",{className:"assistant-filter-bar",children:[["all","الكل"],["grade","الدرجات"],["attendance","الحضور"],["payment","المستحقات"],["lesson","الدروس"]].map(([e,a])=>s.jsx("button",{className:t===e?"active":"",onClick:()=>h(e),children:a},e))}),s.jsxs("div",{className:"assistant-layout",children:[s.jsx("div",{className:"assistant-insights-list",children:r.length?r.map(e=>s.jsxs("article",{className:`assistant-insight ${e.level}`,children:[s.jsx("div",{className:"assistant-icon",children:e.level==="danger"?s.jsx(y,{}):e.type==="lesson"?s.jsx(N,{}):s.jsx(j,{})}),s.jsxs("div",{className:"assistant-copy",children:[s.jsx("span",{children:f[e.level]}),s.jsx("h3",{children:e.title}),s.jsx("p",{children:e.body}),s.jsx("strong",{children:e.action})]}),e.studentId&&s.jsxs("button",{className:"whatsapp-btn",onClick:()=>p(e),children:[s.jsx(m,{size:17})," تواصل"]})]},e.id)):s.jsx("div",{className:"panel empty-state",children:"لا توجد ملاحظات في هذا التصنيف."})}),s.jsxs("aside",{className:"panel assistant-top-students",children:[s.jsxs("div",{className:"panel-title",children:[s.jsx("h3",{children:"أفضل أداء حاليًا"}),s.jsx(b,{size:20})]}),d.map(({student:e,stats:a},i)=>s.jsxs("div",{className:"assistant-rank",children:[s.jsx("b",{children:i+1}),s.jsxs("div",{children:[s.jsx("strong",{children:e.name}),s.jsx("small",{children:e.group})]}),s.jsxs("span",{children:[a.avg,"%"]})]},e.id)),!d.length&&s.jsx("div",{className:"empty-state",children:"لا توجد درجات كافية للتحليل."})]})]})]})}export{S as default};
