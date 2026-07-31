import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  FileVideo,
  GraduationCap,
  Search,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { buildGlobalSearchIndex, searchGlobalIndex } from '../services/globalSearch';

const typeIcons = {
  student: UserRound,
  resource: BookOpen,
  session: CalendarDays,
  recording: FileVideo,
  exam: GraduationCap,
  result: GraduationCap,
  payment: WalletCards,
  question: Search,
};

const typeLabels = {
  student: 'طالب',
  resource: 'محتوى',
  session: 'حصة',
  recording: 'تسجيل',
  exam: 'امتحان',
  result: 'نتيجة',
  payment: 'حسابات',
  question: 'سؤال',
};

export default function GlobalSearch({ open, data, auth, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const resultsRef = useRef([]);
  const index = useMemo(() => buildGlobalSearchIndex(data || {}, auth || {}), [auth, data]);
  const results = useMemo(() => searchGlobalIndex(index, query, 24), [index, query]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && resultsRef.current[0]) {
        onNavigate(resultsRef.current[0].page);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNavigate, open]);

  if (!open) return null;

  return (
    <div className="global-search-backdrop" role="dialog" aria-modal="true" aria-label="البحث الشامل">
      <button className="global-search-dismiss" type="button" onClick={onClose} aria-label="إغلاق البحث" />
      <article className="global-search-panel">
        <header className="global-search-input-row">
          <Search size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن طالب، درس، ملف، امتحان أو تسجيل…"
            aria-label="كلمة البحث"
          />
          <button type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </header>
        <div className="global-search-results">
          {query.trim().length < 2 ? (
            <div className="global-search-empty"><Search size={30} /><strong>اكتب حرفين على الأقل</strong><span>البحث يحترم صلاحية الحساب الحالي.</span></div>
          ) : results.length ? results.map((result) => {
            const Icon = typeIcons[result.type] || Search;
            return (
              <button
                className="global-search-result"
                type="button"
                key={result.id}
                onClick={() => {
                  onNavigate(result.page);
                  onClose();
                }}
              >
                <span className="global-search-result-icon"><Icon size={18} /></span>
                <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                <em>{typeLabels[result.type] || 'نتيجة'}</em>
              </button>
            );
          }) : (
            <div className="global-search-empty"><Search size={30} /><strong>لا توجد نتائج</strong><span>جرّب اسمًا أو كلمة أخرى.</span></div>
          )}
        </div>
      </article>
    </div>
  );
}
