function a(e=""){return String(e).replace(/\/nn/gi,`
`).replace(/\\n/g,`
`).replace(/\n{3,}/g,`

`).trim()}function o(e,n,t){return a(`السلام عليكم ورحمة الله وبركاته

عزيزي ولي الأمر،
نحيط سيادتكم علمًا بأن الطالب: ${e}
${n==="present"?"حضر حصة اليوم.":n==="late"?"حضر متأخرًا إلى حصة اليوم.":"لم يحضر حصة اليوم."}

التاريخ: ${t}

مع خالص الشكر،
المُبدع مصطفى بركات
المُبدع لتعليم ممتع`)}function p(e,n){const r=`https://wa.me/${String(e||"").replace(/\D/g,"").replace(/^0/,"20")}?text=${encodeURIComponent(a(n))}`;window.open(r,"_blank","noopener,noreferrer")}export{o as b,a as c,p as o};
