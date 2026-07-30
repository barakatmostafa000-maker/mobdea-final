import { useMemo, useState } from 'react';
import { BarChart3, BookMarked, BookOpen, ClipboardList, Download, Filter, FolderOpen, MessageCircle, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { buildExamAnalytics, buildAssessmentSummary } from '../services/assessment';
import { buildSmartInsights, studentAnalytics } from '../services/insights';
import { openWhatsApp } from '../services/whatsapp';
import { getAllLibraryGrades, getGradeExams, getGradeTextbook, getLessonsForGrade, librarySummary } from '../services/libraryModel';

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function Reports({ data }) {
  const [group, setGroup] = useState('all');
  const [tab, setTab] = useState('students');
  const groups = [...new Set(data.students.map((item) => item.group).filter(Boolean))];

  const students = useMemo(() => data.students.filter((item) => group === 'all' || item.group === group), [data.students, group]);
  const rows = useMemo(() => students.map((student) => ({ student, ...studentAnalytics(data, student) })), [students, data]);

  const present = data.attendance.filter((item) => ['present', 'late'].includes(item.status)).length;
  const attendanceRate = data.attendance.length ? Math.round((present / data.attendance.length) * 100) : 0;
  const avg = data.grades.length ? Math.round(data.grades.reduce((sum, item) => sum + (item.score / item.total) * 100, 0) / data.grades.length) : 0;
  const due = data.payments.filter((item) => item.type === 'due').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const insights = useMemo(() => buildSmartInsights(data), [data]);
  const contentSummary = useMemo(() => librarySummary(data), [data]);
  const libraryRows = useMemo(() => getAllLibraryGrades(data).map((grade) => ({
    grade,
    textbook: getGradeTextbook(data, grade),
    exams: getGradeExams(data, grade),
    lessons: getLessonsForGrade(data, grade),
  })).filter((row) => row.lessons.length || row.textbook || row.exams), [data]);
  const homeworkRows = useMemo(() => {
    const allowedGrades = group === 'all'
      ? null
      : new Set(students.map((student) => student.grade).filter(Boolean));
    return getAllLibraryGrades(data)
      .filter((grade) => !allowedGrades || allowedGrades.has(grade))
      .flatMap((grade) => getLessonsForGrade(data, grade))
      .filter((lesson) => String(lesson.homework || '').trim())
      .sort((a, b) => String(b.lessonDate || '').localeCompare(String(a.lessonDate || '')));
  }, [data, group, students]);

  const examGroups = useMemo(() => {
    const grouped = new Map();
    (data.detailedResults || []).forEach((result) => {
      const key = result.exam || 'امتحان غير مسمى';
      const current = grouped.get(key) || [];
      current.push(result);
      grouped.set(key, current);
    });
    return [...grouped.entries()].map(([exam, results]) => ({ exam, ...buildExamAnalytics(results), results }));
  }, [data.detailedResults]);

  const overallExam = useMemo(() => buildAssessmentSummary((data.detailedResults || []).map((item) => ({ pct: item.total ? Math.round((item.score / item.total) * 100) : 0 }))), [data.detailedResults]);

  const exportCsv = () => {
    const header = ['الكود', 'الطالب', 'الصف', 'المجموعة', 'متوسط الدرجات', 'نسبة الحضور', 'الغياب', 'التأخر', 'المستحقات', 'نقاط الضعف'];
    const body = rows.map(({ student, ...stats }) => [student.code, student.name, student.grade, student.group, stats.avg ?? '', stats.attendanceRate ?? '', stats.absences, stats.late, stats.due, stats.weaknesses.join(' - ')]);
    const csv = '\uFEFF' + [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mobdea-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const contact = (student, stats) => openWhatsApp(student.guardianPhone, `السلام عليكم ورحمة الله وبركاته\n\nمتابعة الطالب: ${student.name}\nمتوسط الدرجات: ${stats.avg ?? 'لا توجد نتائج'}${stats.avg !== null ? '%' : ''}\nنسبة الحضور: ${stats.attendanceRate ?? 'لا توجد سجلات'}${stats.attendanceRate !== null ? '%' : ''}\n${stats.weaknesses.length ? `نقاط تحتاج مراجعة: ${stats.weaknesses.join('، ')}` : ''}\n\nالمُبدع مصطفى بركات`);

  return (
    <section className="page reports-pro-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">خاص بالإدارة</span>
          <h2>مركز التقارير والتحليل</h2>
          <p>تقرير الطالب، المجموعة، نقاط الضعف، المستحقات، والقرارات المقترحة.</p>
        </div>
        <button className="secondary-btn icon-button" onClick={exportCsv}><Download size={17} /> تصدير CSV</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><Users /><div><span>الطلاب</span><strong>{students.length}</strong><small>{group === 'all' ? 'إجمالي المنصة' : group}</small></div></div>
        <div className="stat-card"><TrendingUp /><div><span>نسبة الحضور</span><strong>{attendanceRate}%</strong><small>كل السجلات</small></div></div>
        <div className="stat-card"><BarChart3 /><div><span>متوسط الدرجات</span><strong>{avg}%</strong><small>كل الامتحانات</small></div></div>
        <div className="stat-card"><TrendingDown /><div><span>المستحقات</span><strong>{due} ج</strong><small>إجمالي المستحق</small></div></div>
      </div>

      <div className="reports-toolbar">
        <div className="report-tabs">
          {[
            ['students', 'الطلاب'],
            ['weakness', 'نقاط الضعف'],
            ['insights', 'التنبيهات الذكية'],
            ['exams', 'الامتحانات'],
            ['homework', 'الواجبات'],
            ['library', 'جاهزية المحتوى']
          ].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
        </div>
        <label><Filter size={16} /><select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">كل المجموعات</option>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      {tab === 'students' && (
        <div className="panel report-table-wrap">
          <table className="report-table">
            <thead>
              <tr><th>الطالب</th><th>الدرجات</th><th>الحضور</th><th>غياب</th><th>مستحق</th><th>متابعة</th></tr>
            </thead>
            <tbody>
              {rows.map(({ student, ...stats }) => (
                <tr key={student.id}>
                  <td><strong>{student.name}</strong><small>{student.code} • {student.group}</small></td>
                  <td><b className={(stats.avg ?? 100) < 60 ? 'danger-text' : 'success-text'}>{stats.avg === null ? '—' : `${stats.avg}%`}</b></td>
                  <td>{stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}</td>
                  <td>{stats.absences}</td>
                  <td>{stats.due} ج</td>
                  <td><button className="whatsapp-btn" onClick={() => contact(student, stats)}><MessageCircle size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'weakness' && (
        <div className="reports-card-grid">
          {rows.filter((item) => item.weaknesses.length).map(({ student, ...stats }) => (
            <article className="panel weakness-card" key={student.id}>
              <header>
                <span className="student-code">{student.code}</span>
                <div>
                  <h3>{student.name}</h3>
                  <p>{student.group}</p>
                </div>
                <b>{stats.avg ?? '—'}{stats.avg !== null ? '%' : ''}</b>
              </header>
              <div>{stats.weaknesses.map((item) => <span key={item}>{item}</span>)}</div>
              <small>نقاط القوة: {stats.strengths.join('، ') || 'لم تسجل بعد'}</small>
            </article>
          ))}
        </div>
      )}

      {tab === 'insights' && (
        <div className="reports-card-grid">
          {insights.map((item) => <article className={`panel report-insight ${item.level}`} key={item.id}><span>{item.level === 'danger' ? 'عاجل' : item.level === 'warning' ? 'تنبيه' : 'اقتراح'}</span><h3>{item.title}</h3><p>{item.body}</p><strong>{item.action}</strong></article>)}
        </div>
      )}

      {tab === 'exams' && (
        <div className="reports-card-grid">
          <article className="panel report-insight info">
            <span>إجمالي</span>
            <h3>{overallExam.totalStudents} نتيجة</h3>
            <p>متوسط الامتحانات الحالية {overallExam.average}% ونسبة النجاح {overallExam.passRate}%.</p>
            <strong>تمت مراجعة نتائج الامتحانات التفصيلية.</strong>
          </article>
          {examGroups.length ? examGroups.map((exam) => (
            <article className={`panel report-insight ${exam.passRate >= 60 ? 'info' : 'warning'}`} key={exam.exam}>
              <span>{exam.count} محاولة</span>
              <h3>{exam.exam}</h3>
              <p>متوسط {exam.average}% — نسبة نجاح {exam.passRate}%.</p>
              <strong>{exam.weakest.length ? `أضعف موضوع: ${exam.weakest[0][0]}` : 'لا توجد موضوعات ضعيفة واضحة بعد.'}</strong>
            </article>
          )) : <div className="panel empty-state">لا توجد نتائج تفصيلية للامتحانات بعد.</div>}
        </div>
      )}


      {tab === 'homework' && (
        <div className="reports-card-grid homework-report-grid">
          {homeworkRows.map((lesson) => (
            <article className="panel homework-report-card" key={lesson.id}>
              <div className="homework-report-icon"><ClipboardList size={21}/></div>
              <div>
                <span className="eyebrow">{lesson.grade}{lesson.lessonDate ? ` • ${lesson.lessonDate}` : ''}</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.homework}</p>
                <small>{lesson.unit || 'بدون وحدة'} • صفحات {lesson.pageStart || 1}–{lesson.pageEnd || lesson.pageStart || 1}</small>
              </div>
            </article>
          ))}
          {!homeworkRows.length && <div className="panel empty-state">لا توجد واجبات محفوظة داخل دروس المكتبة لهذا الاختيار.</div>}
        </div>
      )}

      {tab === 'library' && (
        <div className="library-report-section">
          <div className="library-report-summary">
            <article><BookOpen/><span>كتب الصفوف</span><strong>{contentSummary.textbooks}</strong></article>
            <article><BookMarked/><span>مراجع الامتحانات</span><strong>{contentSummary.exams}</strong></article>
            <article><FolderOpen/><span>الدروس المنظمة</span><strong>{contentSummary.lessons}</strong></article>
            <article><BarChart3/><span>الدروس بلا كتاب</span><strong>{contentSummary.lessonsWithoutTextbook}</strong></article>
          </div>
          <div className="panel report-table-wrap">
            <table className="report-table">
              <thead><tr><th>الصف</th><th>كتاب المنهج</th><th>ملف الامتحانات</th><th>الدروس</th><th>الحالة</th></tr></thead>
              <tbody>{libraryRows.map((row) => {
                const ready = Boolean(row.textbook?.assetId || row.textbook?.url) && Boolean(row.exams?.assetId || row.exams?.url) && row.lessons.length > 0;
                return <tr key={row.grade}><td><strong>{row.grade}</strong></td><td>{row.textbook?.assetId || row.textbook?.url ? 'جاهز' : 'غير مرفوع'}</td><td>{row.exams?.assetId || row.exams?.url ? 'جاهز' : 'غير مرفوع'}</td><td>{row.lessons.length}</td><td><b className={ready ? 'success-text' : 'danger-text'}>{ready ? 'جاهز للحصة' : 'يحتاج استكمال'}</b></td></tr>;
              })}</tbody>
            </table>
            {!libraryRows.length && <div className="empty-state">لم تُنظم محتويات المكتبة حسب الصفوف بعد.</div>}
          </div>
        </div>
      )}
    </section>
  );
}
