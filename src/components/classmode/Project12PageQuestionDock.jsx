// PROJECT13_COLLAPSED_PAGE_QUESTIONS_V1
import { useState } from 'react';
import { BookOpenCheck, ChevronDown, Gamepad2, X } from 'lucide-react';

export default function Project12PageQuestionDock({
  visible = false,
  page = 1,
  pageCount = 0,
  lessonCount = 0,
  manualCount = 0,
  scope = 'page',
  onScope,
  onPrepareGame,
}) {
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  const count = scope === 'page' ? pageCount : scope === 'lesson' ? lessonCount : manualCount;

  return (
    <div className={`project13-question-chip ${open ? 'open' : ''}`} data-testid="pdf-page-question-dock">
      <button type="button" onClick={() => setOpen((value) => !value)} title="أسئلة الصفحة">
        <BookOpenCheck size={14}/><span>أسئلة {pageCount}</span><ChevronDown size={12}/>
      </button>
      {open && (
        <div className="project13-question-popover">
          <header className="panel-heading compact">
            <div><small>صفحة {page}</small><strong>اختيار أسئلة اللعبة</strong></div>
            <button type="button" onClick={() => setOpen(false)} title="إغلاق"><X size={13}/></button>
          </header>
          <div className="project13-scope-row">
            <button type="button" className={scope === 'page' ? 'active' : ''} onClick={() => onScope?.('page')}>الصفحة {pageCount}</button>
            <button type="button" className={scope === 'lesson' ? 'active' : ''} onClick={() => onScope?.('lesson')}>الدرس {lessonCount}</button>
            <button type="button" className={scope === 'manual' ? 'active' : ''} onClick={() => onScope?.('manual')}>يدوي {manualCount}</button>
          </div>
          <button type="button" className="primary-btn" disabled={!count} onClick={() => onPrepareGame?.(scope)}>
            <Gamepad2 size={14}/> {count ? `تجهيز ${count} سؤال` : 'لا توجد أسئلة معتمدة'}
          </button>
          {!pageCount && scope === 'page' && <small>لا توجد أسئلة معتمدة لهذه الصفحة؛ اختر الدرس أو يدوي.</small>}
        </div>
      )}
    </div>
  );
}
