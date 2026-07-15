function percentage(score, total) {
  return total ? Math.round((Number(score) / Number(total)) * 100) : 0;
}

export function studentAnalytics(data, student) {
  const grades = (data.grades || []).filter((item) => item.studentId === student.id);
  const attendance = (data.attendance || []).filter((item) => item.studentId === student.id);
  const payments = (data.payments || []).filter((item) => item.studentId === student.id);

  const avg = grades.length
    ? Math.round(grades.reduce((sum, item) => sum + percentage(item.score, item.total), 0) / grades.length)
    : null;
  const absences = attendance.filter((item) => item.status === 'absent').length;
  const late = attendance.filter((item) => item.status === 'late').length;
  const present = attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;
  const due = payments.filter((item) => item.type === 'due').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paid = payments.filter((item) => item.type === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const weaknesses = [...new Set(grades.flatMap((item) => String(item.weakness || '').split('،')).map((x) => x.trim()).filter(Boolean))];
  const strengths = [...new Set(grades.flatMap((item) => String(item.strength || '').split('،')).map((x) => x.trim()).filter(Boolean))];

  return { avg, absences, late, attendanceRate, due, paid, weaknesses, strengths, gradeCount: grades.length, attendanceCount: attendance.length };
}

export function buildSmartInsights(data) {
  const insights = [];
  const students = data.students || [];

  students.forEach((student) => {
    const stats = studentAnalytics(data, student);
    if (stats.avg !== null && stats.avg < 60) {
      insights.push({
        id: `low-${student.id}`,
        level: 'danger',
        type: 'grade',
        studentId: student.id,
        title: `${student.name} يحتاج متابعة دراسية`,
        body: `متوسطه ${stats.avg}%${stats.weaknesses.length ? `، وأبرز نقاط الضعف: ${stats.weaknesses.slice(0, 3).join('، ')}` : ''}.`,
        action: 'جهّز اختبارًا قصيرًا ومراجعة مركزة.'
      });
    }
    if (stats.absences >= 3) {
      insights.push({
        id: `absence-${student.id}`,
        level: 'danger',
        type: 'attendance',
        studentId: student.id,
        title: `${student.name} غاب ${stats.absences} مرات`,
        body: 'الغياب المتكرر قد يؤثر على مستواه.',
        action: 'تواصل مع ولي الأمر وحدد سبب الغياب.'
      });
    } else if (stats.late >= 2) {
      insights.push({
        id: `late-${student.id}`,
        level: 'warning',
        type: 'attendance',
        studentId: student.id,
        title: `${student.name} يتأخر بشكل متكرر`,
        body: `تم تسجيل ${stats.late} حالات تأخر.`,
        action: 'أرسل تنبيهًا هادئًا لولي الأمر.'
      });
    }
    if (stats.due > 0) {
      insights.push({
        id: `due-${student.id}`,
        level: 'warning',
        type: 'payment',
        studentId: student.id,
        title: `مستحقات على ${student.name}`,
        body: `إجمالي المستحقات ${stats.due} جنيه.`,
        action: 'جهّز رسالة تذكير بالمستحقات.'
      });
    }
  });

  const gradeTopics = {};
  (data.grades || []).forEach((item) => {
    String(item.weakness || '').split('،').map((x) => x.trim()).filter(Boolean).forEach((topic) => {
      gradeTopics[topic] = (gradeTopics[topic] || 0) + 1;
    });
  });
  Object.entries(gradeTopics).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([topic, count]) => {
    if (count >= 2) insights.push({
      id: `topic-${topic}`,
      level: 'info',
      type: 'lesson',
      title: `ضعف متكرر في: ${topic}`,
      body: `${count} نتائج تشير إلى احتياج الطلاب لمراجعة هذا الموضوع.`,
      action: 'أعد شرح الجزئية وأضف جولة ألعاب عليها.'
    });
  });

  const priority = { danger: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => priority[a.level] - priority[b.level]);
}

export function dashboardSummary(data) {
  const insights = buildSmartInsights(data);
  return {
    urgent: insights.filter((item) => item.level === 'danger').length,
    warnings: insights.filter((item) => item.level === 'warning').length,
    suggestions: insights.filter((item) => item.level === 'info').length,
    top: insights.slice(0, 5)
  };
}
