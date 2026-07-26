import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Eye, Printer, Search, ShieldCheck, Square, BadgeCheck, IdCard, School, CalendarDays, UserRound, WalletCards, UsersRound, Sparkles, ArrowLeftRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { identity } from '../config/identity';

const CARD_PRESETS = {
  4: { cols: 2, rows: 2, label: '2 × 2' },
  6: { cols: 2, rows: 3, label: '2 × 3' },
  8: { cols: 2, rows: 4, label: '2 × 4' },
  12: { cols: 3, rows: 4, label: '3 × 4' },
  16: { cols: 4, rows: 4, label: '4 × 4' },
  24: { cols: 4, rows: 6, label: '4 × 6' },
  30: { cols: 5, rows: 6, label: '5 × 6' },
  36: { cols: 6, rows: 6, label: '6 × 6' },
  48: { cols: 6, rows: 8, label: '6 × 8' },
  60: { cols: 6, rows: 10, label: '6 × 10' },
  72: { cols: 8, rows: 9, label: '8 × 9' }
};

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function MiniBarcode({ value }) {
  const seed = String(value || '000000');
  const bars = Array.from({ length: 28 }, (_, index) => {
    const char = seed.charCodeAt(index % seed.length) || 48;
    return ((char + index * 17) % 5) + 1;
  });

  return (
    <svg viewBox="0 0 120 44" className="mini-barcode" aria-hidden="true">
      <rect width="120" height="44" rx="6" fill="#fff" />
      {bars.map((bar, index) => {
        const x = 5 + index * 4;
        const h = 24 + ((bar * 3) % 12);
        const y = 8 + (12 - (h - 24));
        return <rect key={index} x={x} y={y} width={bar} height={h} fill="#111" rx="0.5" />;
      })}
      <rect x="5" y="8" width="1.5" height="28" fill="#111" />
      <rect x="113.5" y="8" width="1.5" height="28" fill="#111" />
    </svg>
  );
}

function CardField({ label, value, icon, wide = false }) {
  return (
    <div className={`card-field-row ${wide ? 'wide' : ''}`}>
      <div className="card-field-icon">{icon}</div>
      <div className="card-field-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function FrontCard({ student }) {
  const year = student.year || student.schoolYear || '2026 - 2026';
  const subscription = student.sessionPrice != null ? `${student.sessionPrice} ج للحصة` : '—';

  return (
    <article className="student-card-face front-card">
      <div className="front-panel-image">
        <img src={identity.portrait} alt={identity.teacherName} />
        <div className="front-panel-overlay">
          <div className="front-panel-badge">{identity.schoolName}</div>
          <div className="front-panel-brand">
            <strong>المبدع</strong>
            <span>لتعليم ممتع</span>
          </div>
        </div>
      </div>

      <div className="front-panel-details">
        <div className="front-headline">
          <div>
            <span className="eyebrow">المبدع</span>
            <h3>{identity.teacherName}</h3>
            <p>{identity.teacherTitle}</p>
          </div>
          <div className="front-round-mark">
            <img src={identity.icon} alt={identity.schoolName} />
          </div>
        </div>

        <div className="front-title-block">
          <h4>{student.name}</h4>
          <p>{student.grade}</p>
        </div>

        <div className="front-info-list">
          <CardField label="اسم الطالب" value={student.name} icon={<UserRound size={16} />} wide />
          <CardField label="كود الطالب" value={student.code} icon={<IdCard size={16} />} />
          <CardField label="المرحلة" value={student.grade} icon={<School size={16} />} wide />
          <CardField label="الفصل" value={student.group || '—'} icon={<UsersRound size={16} />} />
          <CardField label="الاشتراك" value={subscription} icon={<WalletCards size={16} />} />
          <CardField label="العام الدراسي" value={year} icon={<CalendarDays size={16} />} />
        </div>

        <div className="front-id-area">
          <div className="front-barcode-card">
            <MiniBarcode value={student.code} />
            <div className="barcode-number">{student.code}</div>
          </div>
          <div className="front-qr-card">
            <QRCodeSVG value={JSON.stringify({ type: 'mobdea-student', code: student.code, name: student.name, grade: student.grade, group: student.group })} size={92} level="H" includeMargin />
          </div>
        </div>
      </div>
    </article>
  );
}

function BackCard() {
  return (
    <article className="student-card-face back-card">
      <div className="back-banner">
        <div className="back-banner-logo">
          <img src={identity.icon} alt={identity.schoolName} />
        </div>
        <div>
          <strong>المبدع</strong>
          <span>لتعليم ممتع</span>
        </div>
      </div>

      <div className="back-content-grid">
        <div className="back-benefits-panel">
          <h4>هذا الكارت خاص بمنصة المبدع</h4>
          <div className="back-benefits">
            <div><BadgeCheck size={18} /><p>يستخدم للحضور والانصراف</p></div>
            <div><Sparkles size={18} /><p>متابعة الدرجات والتقارير</p></div>
            <div><ArrowLeftRight size={18} /><p>يعمل مع QR والرقم المخصص</p></div>
            <div><WalletCards size={18} /><p>متابعة الاشتراك والمستحقات</p></div>
          </div>
        </div>

        <div className="back-portrait-panel">
          <div className="back-portrait-ring">
            <div className="back-portrait-plate">
              <img src={identity.portrait} alt={identity.teacherName} />
            </div>
          </div>
          <div className="back-quote">"من جد وجد ومن زرع حصد"</div>
        </div>

        <div className="back-copy-panel">
          <div className="back-copy-block">
            <h3>هذا الكارت خاص بمنصة المبدع</h3>
            <p>لا يستخدم إلا للحضور والانصراف والمتابعة التعليمية داخل المنصة.</p>
          </div>
          <div className="back-landmarks" aria-hidden="true">
            <span>⟡</span><span>⟡</span><span>⟡</span>
          </div>
          <div className="back-signature">
            <strong>المبدع</strong>
            <small>لتعليم ممتع</small>
          </div>
        </div>
      </div>
    </article>
  );
}

function PrintSheet({ students, side, columns, rows }) {
  const slots = columns * rows;
  const filler = Array.from({ length: Math.max(0, slots - students.length) }, () => null);
  const cards = [...students, ...filler].slice(0, slots);

  return (
    <section className="print-sheet">
      <div className="print-sheet-grid" style={{ '--print-columns': columns, '--print-rows': rows }}>
        {cards.map((student, index) => (
          <div key={student ? student.id : `empty-${index}`} className={`print-slot ${student ? 'has-card' : 'empty-slot'}`}>
            {student ? (side === 'back' ? <BackCard /> : <FrontCard student={student} />) : <div className="empty-card-slot" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function PrintRun({ title, students, side, columns, rows }) {
  const pages = chunk(students, columns * rows);

  return (
    <section className="print-run">
      <div className="print-run-header">
        <h2>{title}</h2>
        <p>{side === 'both' ? 'يتم طباعة الوجه الأمامي ثم الخلفي في صفحات منفصلة' : `طباعة ${side === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}`}</p>
      </div>
      <div className="print-pack">
        {pages.map((pageStudents, index) => (
          <div className="print-pack-page" key={`${side}-${index}`}>
            <div className="print-pack-label">الصفحة {index + 1} — {side === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}</div>
            <PrintSheet students={pageStudents} side={side} columns={columns} rows={rows} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StudentCards({ data }) {
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [side, setSide] = useState('front');
  const [printMode, setPrintMode] = useState('front');
  const [cardsPerPage, setCardsPerPage] = useState(24);
  const [selectedStudentId, setSelectedStudentId] = useState(data.students[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState([]);

  const groups = [...new Set(data.students.map((student) => student.group).filter(Boolean))];
  const filteredStudents = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.students.filter((student) => {
      const haystack = `${student.name} ${student.code} ${student.grade} ${student.group}`.toLowerCase();
      return (group === 'all' || student.group === group) && (!search || haystack.includes(search));
    });
  }, [data.students, group, query]);

  const visibleIds = useMemo(() => filteredStudents.map((student) => student.id), [filteredStudents]);

  useEffect(() => {
    if (!filteredStudents.length) {
      if (selectedStudentId !== null) setSelectedStudentId(null);
      return;
    }
    if (!filteredStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0]?.id || data.students[0]?.id || null);
    }
  }, [filteredStudents, selectedStudentId, data.students]);

  const selectedVisibleStudents = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const pick = filteredStudents.filter((student) => selectedSet.has(student.id));
    return pick.length ? pick : filteredStudents;
  }, [filteredStudents, selectedIds]);

  const activeStudent = filteredStudents.find((student) => student.id === selectedStudentId) || filteredStudents[0] || data.students[0];
  const preset = CARD_PRESETS[cardsPerPage] || CARD_PRESETS[24];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleStudent = (studentId) => {
    setSelectedIds((current) => (current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId]));
  };

  const selectAllVisible = () => setSelectedIds(visibleIds);
  const clearSelection = () => setSelectedIds([]);

  return (
    <section className="page student-card-lab">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">تصميم وطباعة كارت الطالب</span>
          <h2>كروت الطلاب</h2>
          <p>التصميم ثابت كما هو، مع معاينة الوجه الأمامي والخلفي وطباعة عدد كبير من الطلاب في الصفحة الواحدة.</p>
        </div>
        <button className="primary-btn icon-button" onClick={() => window.print()} type="button"><Printer size={18} /> طباعة الكروت</button>
      </div>

      <div className="student-card-toolbar no-print panel">
        <label>
          <span>اختيار الطالب</span>
          <select value={activeStudent?.id || ''} onChange={(event) => setSelectedStudentId(Number(event.target.value))}>
            {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.code} — {student.name}</option>)}
          </select>
        </label>

        <label>
          <span>المجموعة</span>
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">كل المجموعات</option>
            {groups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label className="card-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الكود أو الصف" />
        </label>

        <label>
          <span>عدد الكروت في الصفحة</span>
          <select value={cardsPerPage} onChange={(event) => setCardsPerPage(Number(event.target.value))}>
            {Object.entries(CARD_PRESETS).map(([count, presetInfo]) => <option key={count} value={count}>{count} كارت ({presetInfo.label})</option>)}
          </select>
        </label>

        <div className="side-toggle-group">
          <button type="button" className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}><Eye size={16} /> معاينة الوجه الأمامي</button>
          <button type="button" className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}><Eye size={16} /> معاينة الوجه الخلفي</button>
        </div>
      </div>

      <div className="student-card-workbench no-print">
        <div className="card-preview-stage panel">
          <div className="preview-head">
            <div>
              <span className="eyebrow">{side === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}</span>
              <h3>{activeStudent ? activeStudent.name : 'لا يوجد طالب محدد'}</h3>
              <p>التصميم ثابت والبيانات فقط هي التي تتغير.</p>
            </div>
            <div className="preview-mini-stats">
              <span><strong>{filteredStudents.length}</strong> طالب</span>
              <span><strong>{selectedVisibleStudents.length}</strong> محدد</span>
              <span><strong>{Math.ceil(selectedVisibleStudents.length / cardsPerPage)}</strong> صفحة</span>
            </div>
          </div>

          {activeStudent ? (
            <div className="large-card-preview">
              {side === 'back' ? <BackCard /> : <FrontCard student={activeStudent} />}
            </div>
          ) : (
            <div className="empty-state">لا توجد كروت مطابقة للبحث.</div>
          )}
        </div>

        <aside className="card-print-info panel">
          <div className="print-note">
            <ShieldCheck size={18} />
            <span>المعاينة هنا تعرض الوجه المختار فقط، والطباعة تدعم طباعة مجموعة كبيرة من الطلاب في الصفحة الواحدة.</span>
          </div>

          <div className="print-summary-list">
            <div><span>إجمالي الطلاب</span><strong>{data.students.length}</strong></div>
            <div><span>الطلاب بعد الفلترة</span><strong>{filteredStudents.length}</strong></div>
            <div><span>الطلاب المحددون</span><strong>{selectedVisibleStudents.length}</strong></div>
            <div><span>تنسيق الصفحة</span><strong>{preset.label} — {cardsPerPage} كارت</strong></div>
          </div>

          <div className="selection-actions">
            <button className="secondary-btn" onClick={selectAllVisible} disabled={!visibleIds.length || allVisibleSelected} type="button"><CheckSquare size={16} /> تحديد الكل</button>
            <button className="secondary-btn" onClick={clearSelection} type="button"><Square size={16} /> إلغاء التحديد</button>
          </div>

          <div className="print-mode-group">
            <span>نوع الطباعة</span>
            <div className="side-toggle-group compact">
              <button type="button" className={printMode === 'front' ? 'active' : ''} onClick={() => setPrintMode('front')}>الوجه الأمامي</button>
              <button type="button" className={printMode === 'back' ? 'active' : ''} onClick={() => setPrintMode('back')}>الوجه الخلفي</button>
              <button type="button" className={printMode === 'both' ? 'active' : ''} onClick={() => setPrintMode('both')}>الوجهين</button>
            </div>
          </div>

          <div className="card-student-select-list">
            {filteredStudents.map((student) => (
              <label key={student.id} className={`card-student-select-row ${selectedIds.includes(student.id) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                <span className="student-code">{student.code}</span>
                <div>
                  <strong>{student.name}</strong>
                  <small>{student.grade} — {student.group}</small>
                </div>
              </label>
            ))}
          </div>

          <div className="card-print-actions">
            <button className="primary-btn icon-button" onClick={() => window.print()} type="button"><Printer size={18} /> طباعة {printMode === 'both' ? 'الوجهين' : (printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي')}</button>
          </div>
        </aside>
      </div>

      <div className="print-pack no-print">
        {printMode === 'both' ? (
          <>
            <PrintRun title="الوجه الأمامي" students={selectedVisibleStudents} side="front" columns={preset.cols} rows={preset.rows} />
            <div className="print-run-separator" />
            <PrintRun title="الوجه الخلفي" students={selectedVisibleStudents} side="back" columns={preset.cols} rows={preset.rows} />
          </>
        ) : (
          <PrintRun
            title={printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
            students={selectedVisibleStudents}
            side={printMode}
            columns={preset.cols}
            rows={preset.rows}
          />
        )}
      </div>

      <div className="print-only">
        {printMode === 'both' ? (
          <>
            <PrintRun title="الوجه الأمامي" students={selectedVisibleStudents} side="front" columns={preset.cols} rows={preset.rows} />
            <div className="print-run-separator" />
            <PrintRun title="الوجه الخلفي" students={selectedVisibleStudents} side="back" columns={preset.cols} rows={preset.rows} />
          </>
        ) : (
          <PrintRun
            title={printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
            students={selectedVisibleStudents}
            side={printMode}
            columns={preset.cols}
            rows={preset.rows}
          />
        )}
      </div>
    </section>
  );
}
