import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Eye, Printer, Search, ShieldCheck, Square, BadgeCheck, IdCard, School, CalendarDays, UserRound, WalletCards, UsersRound, Sparkles, ArrowLeftRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { identity } from '../config/identity';
import { currentAcademicYear, mirrorCardsForDuplex } from '../utils/printLayout';
import { printCurrentView } from '../services/nativePlatform';

const CARD_PRESETS = {
  4: { cols: 2, rows: 2, label: '2 × 2' },
  6: { cols: 3, rows: 2, label: '3 × 2' },
  9: { cols: 3, rows: 3, label: '3 × 3 — مقاس عملي' },
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
  const year =
    student.year || student.schoolYear || currentAcademicYear();

  const code = String(student.code || '');

  const qrValue = JSON.stringify({
    type: 'mobdea-student',
    code,
    name: student.name || '',
    grade: student.grade || '',
    group: student.group || '',
  });

  return (
    <article
      className="student-card-face front-card student-card-template-card student-card-template-front"
      dir="rtl"
    >
      <img
        className="student-card-template-image"
        src={`${import.meta.env.BASE_URL}identity/card-templates/student-card-front.png`}
        alt={`وجه كارت ${student.name || 'الطالب'}`}
        draggable="false"
      />

      <div className="student-card-template-value student-card-template-name">
        {student.name || '—'}
      </div>

      <div
        className="student-card-template-value student-card-template-code"
        dir="ltr"
      >
        {code || '—'}
      </div>

      <div className="student-card-template-value student-card-template-grade">
        {student.grade || '—'}
      </div>

      <div className="student-card-template-value student-card-template-group">
        {student.group || '—'}
      </div>

      <div
        className="student-card-template-value student-card-template-year"
        dir="ltr"
      >
        {year || '—'}
      </div>

      <div className="student-card-template-id">
        <MiniBarcode value={code} />
        <strong>{code || '—'}</strong>
        <QRCodeSVG value={qrValue} size={96} includeMargin />
      </div>
    </article>
  );
}

function BackCard() {
  return (
    <article className="student-card-face back-card student-card-template-card student-card-template-back">
      <img
        className="student-card-template-image"
        src={`${import.meta.env.BASE_URL}identity/card-templates/student-card-back.png`}
        alt="ظهر كارت منصة المبدع"
        draggable="false"
      />
    </article>
  );
}

function PrintSheet({ students, side, columns, rows, duplexMode = 'none' }) {
  const slots = columns * rows;
  const filler = Array.from({ length: Math.max(0, slots - students.length) }, () => null);
  const rawCards = [...students, ...filler].slice(0, slots);
  const cards = side === 'back' ? mirrorCardsForDuplex(rawCards, columns, duplexMode) : rawCards;

  return (
    <section className={`print-sheet ${side === 'back' && duplexMode !== 'none' ? 'duplex-mirrored' : ''}`} data-side={side}>
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

function PrintRun({ title, students, side, columns, rows, duplexMode = 'none' }) {
  const pages = chunk(students, columns * rows);

  return (
    <section className="print-run">
      <div className="print-run-header">
        <h2>{title}</h2>
        <p>{side === 'both' ? 'يتم طباعة الوجه الأمامي ثم الخلفي في صفحات منفصلة' : `طباعة ${side === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}`}</p>
      </div>
      <div className="print-pack">
        {pages.map((pageStudents, index) => (
          <div className={`print-pack-page ${index === pages.length - 1 ? 'last-page' : ''}`} key={`${side}-${index}`}>
            <div className="print-pack-label">الصفحة {index + 1} — {side === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}</div>
            <PrintSheet students={pageStudents} side={side} columns={columns} rows={rows} duplexMode={duplexMode} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StudentCards({ data, auth }) {
  const isOwnCardOnly = auth?.role === 'student';
  const rosterStudents = useMemo(
    () => (isOwnCardOnly ? data.students.filter((student) => String(student.id) === String(auth.studentId)) : data.students),
    [data.students, isOwnCardOnly, auth?.studentId]
  );
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [side, setSide] = useState('front');
  const [printMode, setPrintMode] = useState('front');
  const [cardsPerPage, setCardsPerPage] = useState(9);
  const [duplexMode, setDuplexMode] = useState('flip-long-edge');
  const [selectedStudentId, setSelectedStudentId] = useState(rosterStudents[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState(isOwnCardOnly && rosterStudents[0] ? [rosterStudents[0].id] : []);
  const [printNotice, setPrintNotice] = useState('');
  const [printing, setPrinting] = useState(false);

  const groups = [...new Set(rosterStudents.map((student) => student.group).filter(Boolean))];
  const filteredStudents = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rosterStudents.filter((student) => {
      const haystack = `${student.name} ${student.code} ${student.grade} ${student.group}`.toLowerCase();
      return (group === 'all' || student.group === group) && (!search || haystack.includes(search));
    });
  }, [rosterStudents, group, query]);

  const visibleIds = useMemo(() => filteredStudents.map((student) => student.id), [filteredStudents]);

  useEffect(() => {
    if (!filteredStudents.length) {
      if (selectedStudentId !== null) setSelectedStudentId(null);
      return;
    }
    if (!filteredStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0]?.id || rosterStudents[0]?.id || null);
    }
  }, [filteredStudents, selectedStudentId, rosterStudents]);

  const selectedVisibleStudents = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const pick = filteredStudents.filter((student) => selectedSet.has(student.id));
    return pick.length ? pick : filteredStudents;
  }, [filteredStudents, selectedIds]);

  const activeStudent = filteredStudents.find((student) => student.id === selectedStudentId) || filteredStudents[0] || rosterStudents[0];
  const preset = CARD_PRESETS[cardsPerPage] || CARD_PRESETS[24];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleStudent = (studentId) => {
    setSelectedIds((current) => (current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId]));
  };

  const selectAllVisible = () => setSelectedIds(visibleIds);
  const clearSelection = () => setSelectedIds([]);

  const waitForPrintableAssets = async () => {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => null);
    const images = [...document.querySelectorAll('.print-only img')];
    await Promise.all(images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        window.setTimeout(done, 5000);
      });
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  const waitForPrintDialogToClose = () => new Promise((resolve) => {
    let dialogOpened = false;
    let settled = false;
    let fallbackTimer = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('blur', markOpened);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(fallbackTimer);
      resolve();
    };

    const markOpened = () => {
      dialogOpened = true;
    };

    const handleReturn = () => {
      if (dialogOpened) window.setTimeout(finish, 450);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') dialogOpened = true;
      if (dialogOpened && document.visibilityState === 'visible') {
        window.setTimeout(finish, 450);
      }
    };

    window.addEventListener('blur', markOpened);
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleVisibility);

    // Some Android print services do not emit blur/visibility events. Keep the
    // printable DOM alive long enough for their asynchronous snapshot instead
    // of removing it after two seconds and producing a blank PDF.
    fallbackTimer = window.setTimeout(finish, 30000);
  });

  const startPrinting = async () => {
    if (!selectedVisibleStudents.length) {
      setPrintNotice('حدد طالبًا واحدًا على الأقل قبل الطباعة.');
      return;
    }
    setPrinting(true);
    setPrintNotice('جارٍ تجهيز الكروت والصور والخطوط…');
    document.body.classList.add('mobdea-printing-cards');
    try {
      await waitForPrintableAssets();
      // Give the WebView one complete paint before Android creates the print
      // document adapter. This prevents a blank first snapshot.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      await printCurrentView('بطاقات طلاب المبدع');
      setPrintNotice('معاينة الطباعة مفتوحة. اختر الحفظ بصيغة PDF أو الطابعة.');
      await waitForPrintDialogToClose();
    } catch (error) {
      setPrintNotice(error?.message || 'تعذر تشغيل الطباعة على هذا الجهاز.');
    } finally {
      document.body.classList.remove('mobdea-printing-cards');
      setPrinting(false);
    }
  };

  return (
    <section className="page student-card-lab cards-v103">
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">تصميم وطباعة كارت الطالب</span>
          <h2>كروت الطلاب</h2>
          <p>التصميم ثابت كما هو، مع معاينة الوجه الأمامي والخلفي وطباعة عدد كبير من الطلاب في الصفحة الواحدة.</p>
        </div>
        <button className="primary-btn icon-button" onClick={() => void startPrinting()} disabled={printing} type="button"><Printer size={18} /> {printing ? 'جارٍ التجهيز…' : 'طباعة الكروت'}</button>
      </div>

      {printNotice && <div className="settings-notice card-print-notice no-print">{printNotice}</div>}

      <div className="student-card-toolbar no-print panel">
        <label>
          <span>اختيار الطالب</span>
          <select value={activeStudent?.id || ''} onChange={(event) => setSelectedStudentId(Number(event.target.value))}>
            {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.code} — {student.name}</option>)}
          </select>
        </label>

        <label>
          <span>المجموعة</span>
        {!isOwnCardOnly && (
        <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">كل المجموعات</option>
            {groups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        )}
        </label>

        {!isOwnCardOnly && (
        <label className="card-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الكود أو الصف" />
        </label>
        )}

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
            <div><span>إجمالي الطلاب</span><strong>{rosterStudents.length}</strong></div>
            <div><span>الطلاب بعد الفلترة</span><strong>{filteredStudents.length}</strong></div>
            <div><span>الطلاب المحددون</span><strong>{selectedVisibleStudents.length}</strong></div>
            <div><span>تنسيق الصفحة</span><strong>{preset.label} — {cardsPerPage} كارت</strong></div>
          </div>

          {!isOwnCardOnly && (
          <div className="selection-actions">
            <button className="secondary-btn" onClick={selectAllVisible} disabled={!visibleIds.length || allVisibleSelected} type="button"><CheckSquare size={16} /> تحديد الكل</button>
            <button className="secondary-btn" onClick={clearSelection} type="button"><Square size={16} /> إلغاء التحديد</button>
          </div>
          )}

          <div className="print-mode-group">
            <span>نوع الطباعة</span>
            <div className="side-toggle-group compact">
              <button type="button" className={printMode === 'front' ? 'active' : ''} onClick={() => setPrintMode('front')}>الوجه الأمامي</button>
              <button type="button" className={printMode === 'back' ? 'active' : ''} onClick={() => setPrintMode('back')}>الوجه الخلفي</button>
              <button type="button" className={printMode === 'both' ? 'active' : ''} onClick={() => setPrintMode('both')}>الوجهين</button>
            </div>
          </div>

          <label className="duplex-mode-control">
            <span>محاذاة ظهر الكارت عند الطباعة على الوجهين</span>
            <select value={duplexMode} onChange={(event) => setDuplexMode(event.target.value)}>
              <option value="flip-long-edge">قلب على الحافة الطويلة — عكس الأعمدة</option>
              <option value="flip-short-edge">قلب على الحافة القصيرة — تدوير ترتيب الصفحة</option>
              <option value="none">بدون عكس — للطباعة اليدوية</option>
            </select>
            <small>استخدم الإعداد المطابق لطريقة Duplex في الطابعة حتى يأتي الظهر خلف نفس الطالب.</small>
          </label>

          {!isOwnCardOnly && (
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
          )}

          <div className="card-print-actions">
            <button className="primary-btn icon-button" onClick={() => void startPrinting()} disabled={printing} type="button"><Printer size={18} /> {printing ? 'جارٍ تجهيز الطباعة…' : `طباعة ${printMode === 'both' ? 'الوجهين' : (printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي')}`}</button>
          </div>
        </aside>
      </div>

      <div className="print-pack no-print">
        {printMode === 'both' ? (
          <>
            <PrintRun title="الوجه الأمامي" students={selectedVisibleStudents} side="front" columns={preset.cols} rows={preset.rows} duplexMode={duplexMode} />
            <div className="print-run-separator" />
            <PrintRun title="الوجه الخلفي" students={selectedVisibleStudents} side="back" columns={preset.cols} rows={preset.rows} duplexMode={duplexMode} />
          </>
        ) : (
          <PrintRun
            title={printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
            students={selectedVisibleStudents}
            side={printMode}
            columns={preset.cols}
            rows={preset.rows}
            duplexMode={duplexMode}
          />
        )}
      </div>

      <div className="print-only">
        {printMode === 'both' ? (
          <>
            <PrintRun title="الوجه الأمامي" students={selectedVisibleStudents} side="front" columns={preset.cols} rows={preset.rows} duplexMode={duplexMode} />
            <div className="print-run-separator" />
            <PrintRun title="الوجه الخلفي" students={selectedVisibleStudents} side="back" columns={preset.cols} rows={preset.rows} duplexMode={duplexMode} />
          </>
        ) : (
          <PrintRun
            title={printMode === 'front' ? 'الوجه الأمامي' : 'الوجه الخلفي'}
            students={selectedVisibleStudents}
            side={printMode}
            columns={preset.cols}
            rows={preset.rows}
            duplexMode={duplexMode}
          />
        )}
      </div>
    </section>
  );
}
