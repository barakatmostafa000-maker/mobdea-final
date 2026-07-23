import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Image,
  Layers3,
  Link as LinkIcon,
  Map,
  PencilLine,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Presentation,
  Trash2,
  Eye,
  GripVertical,
  BookMarked,
  LayoutList,
  Save,
} from 'lucide-react';

const resourceTypes = {
  video: { label: 'فيديو', icon: PlayCircle, hint: 'عرض مرئي سريع' },
  pdf: { label: 'PDF', icon: FileText, hint: 'شرح أو كتاب' },
  image: { label: 'صورة', icon: Image, hint: 'خريطة أو وسيلة' },
  map: { label: 'خريطة', icon: Map, hint: 'نشاط جغرافي' },
  slides: { label: 'عرض', icon: Presentation, hint: 'عرض الحصة' },
  link: { label: 'رابط', icon: LinkIcon, hint: 'مصدر خارجي' },
};

const flowLabels = {
  preview: 'تمهيد',
  board: 'السبورة',
  practice: 'تدريب',
  quiz: 'تقويم سريع',
};

const emptyForm = {
  id: null,
  title: '',
  grade: 'الصف السادس الابتدائي',
  term: 'الترم الأول',
  unit: 'الوحدة الأولى',
  lesson: 'الدرس الأول',
  type: 'pdf',
  url: '',
  notes: '',
  pageStart: '',
  pageEnd: '',
  tags: '',
  sequence: ['preview', 'board', 'practice'],
};

const normalizeSequence = (sequence) => {
  if (Array.isArray(sequence)) return sequence.filter(Boolean);
  if (typeof sequence === 'string') {
    return sequence.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return ['preview', 'board', 'practice'];
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') {
    return tags.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeResource = (item) => ({
  ...item,
  pageStart: item.pageStart ?? '',
  pageEnd: item.pageEnd ?? '',
  tags: normalizeTags(item.tags),
  sequence: normalizeSequence(item.sequence),
});

const formatPages = (item) => {
  const start = item.pageStart || item.pages?.start || '';
  const end = item.pageEnd || item.pages?.end || '';
  if (start && end) return `ص ${start} — ${end}`;
  if (start) return `من ص ${start}`;
  if (end) return `حتى ص ${end}`;
  return 'بدون صفحات';
};

const matchesText = (resource, search) => {
  if (!search) return true;
  const haystack = [resource.title, resource.grade, resource.term, resource.unit, resource.lesson, resource.notes, ...(resource.tags || [])]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
};

export default function ContentLibrary({ data, updateData }) {
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('all');
  const [unit, setUnit] = useState('all');
  const [lesson, setLesson] = useState('all');
  const [type, setType] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);

  const items = useMemo(() => (data.contentLibrary || []).map(normalizeResource), [data.contentLibrary]);
  const grades = [...new Set(items.map((item) => item.grade).filter(Boolean))];
  const units = [...new Set(items.filter((item) => grade === 'all' || item.grade === grade).map((item) => item.unit).filter(Boolean))];
  const lessons = [...new Set(items.filter((item) => (grade === 'all' || item.grade === grade) && (unit === 'all' || item.unit === unit)).map((item) => item.lesson).filter(Boolean))];
  const filtered = useMemo(() => items.filter((item) => (grade === 'all' || item.grade === grade) && (unit === 'all' || item.unit === unit) && (lesson === 'all' || item.lesson === lesson) && (type === 'all' || item.type === type) && matchesText(item, search)), [items, grade, unit, lesson, type, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((item) => String(item.id) === String(selectedId))) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => String(item.id) === String(selectedId)) || filtered[0] || null;
  const SelectedIcon = (resourceTypes[selected?.type] || resourceTypes.link).icon;

  const resetForm = () => setForm(emptyForm);

  const startAdd = () => {
    resetForm();
    setShowAdd((value) => !value);
  };

  const editItem = (item) => {
    setForm({
      ...emptyForm,
      ...item,
      tags: normalizeTags(item.tags).join(', '),
      sequence: normalizeSequence(item.sequence),
    });
    setShowAdd(true);
  };

  const saveItem = async () => {
    if (!form.title.trim() || !form.url.trim()) return;
    const nextItem = normalizeResource({
      id: form.id ?? Date.now(),
      title: form.title.trim(),
      grade: form.grade.trim(),
      term: form.term.trim(),
      unit: form.unit.trim(),
      lesson: form.lesson.trim(),
      type: form.type,
      url: form.url.trim(),
      notes: form.notes.trim(),
      pageStart: form.pageStart ? Number(form.pageStart) : '',
      pageEnd: form.pageEnd ? Number(form.pageEnd) : '',
      tags: normalizeTags(form.tags),
      sequence: form.sequence.length ? form.sequence : ['preview', 'board', 'practice'],
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const remaining = items.filter((item) => item.id !== nextItem.id);
    await updateData({
      ...data,
      contentLibrary: [...remaining, nextItem].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    });
    setSelectedId(nextItem.id);
    setShowAdd(false);
    resetForm();
  };

  const removeItem = async (id) => {
    await updateData({
      ...data,
      contentLibrary: items.filter((item) => item.id !== id),
    });
    if (String(selectedId) === String(id)) setSelectedId(null);
  };

  const pinForClass = async (item) => {
    await updateData({
      ...data,
      settings: {
        ...data.settings,
        classResourceId: item.id,
        classResourceTitle: item.title,
      },
    });
  };

  const toggleSequence = (step) => {
    setForm((previous) => {
      const exists = previous.sequence.includes(step);
      return {
        ...previous,
        sequence: exists ? previous.sequence.filter((item) => item !== step) : [...previous.sequence, step],
      };
    });
  };

  const activeType = resourceTypes[form.type] || resourceTypes.link;

  return (
    <section className="page content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">صفحة الشرح والمحتوى</span>
          <h2>مكتبة المُبدع التعليمية</h2>
          <p>فيديو وPDF وصور وخرائط وعروض وروابط مرتبة حسب الصف والوحدة والدرس، مع خط سير للحصة.</p>
        </div>
        <div className="content-page-actions">
          <button className="secondary-btn" onClick={startAdd}><Plus size={18}/> {showAdd ? 'إغلاق النموذج' : 'إضافة محتوى'}</button>
          {selected && <button className="primary-btn" onClick={() => pinForClass(selected)}><Sparkles size={18}/> تثبيت في الحصة</button>}
        </div>
      </div>

      <div className="content-toolbar panel">
        <div className="content-search-box">
          <Search size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو الوحدة أو الدرس أو الوسم" />
        </div>
        <div className="content-filters-grid">
          <select value={grade} onChange={(e) => { setGrade(e.target.value); setUnit('all'); setLesson('all'); }}>
            <option value="all">كل الصفوف</option>
            {grades.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={unit} onChange={(e) => { setUnit(e.target.value); setLesson('all'); }}>
            <option value="all">كل الوحدات</option>
            {units.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={lesson} onChange={(e) => setLesson(e.target.value)}>
            <option value="all">كل الدروس</option>
            {lessons.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">كل الأنواع</option>
            {Object.entries(resourceTypes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </div>
      </div>

      {showAdd && <article className="panel content-form-panel">
        <div className="form-preview-card">
          <div className="content-icon-large"><activeType.icon size={32} /></div>
          <div>
            <strong>{activeType.label}</strong>
            <small>{activeType.hint}</small>
          </div>
        </div>
        <div className="content-form-grid">
          <input placeholder="عنوان المحتوى" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <input placeholder="الترم" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
          <input placeholder="الوحدة" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input placeholder="الدرس" value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(resourceTypes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
          <input placeholder="بداية الصفحات" type="number" min="1" value={form.pageStart} onChange={(e) => setForm({ ...form, pageStart: e.target.value })} />
          <input placeholder="نهاية الصفحات" type="number" min="1" value={form.pageEnd} onChange={(e) => setForm({ ...form, pageEnd: e.target.value })} />
          <input className="span-2" placeholder="رابط الملف أو الفيديو" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <input className="span-2" placeholder="وسوم مفصولة بفواصل: خريطة، تمهيد، اختبار" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <textarea className="span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="sequence-builder">
          {Object.entries(flowLabels).map(([key, label]) => (
            <button key={key} type="button" className={form.sequence.includes(key) ? 'active' : ''} onClick={() => toggleSequence(key)}>
              <GripVertical size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="content-form-actions">
          <button className="secondary-btn" onClick={resetForm}><LayoutList size={16}/> تفريغ</button>
          <button className="primary-btn" onClick={saveItem}><Save size={16}/> {form.id ? 'تحديث المحتوى' : 'حفظ المحتوى'}</button>
        </div>
      </article>}

      <div className="content-workspace">
        <div className="content-grid-shell">
          <div className="content-grid">
            {filtered.map((item) => {
              const typeInfo = resourceTypes[item.type] || resourceTypes.link;
              const Icon = typeInfo.icon;
              const isSelected = String(selectedId) === String(item.id);
              return (
                <article className={`content-card ${isSelected ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                  <div className="content-icon"><Icon /></div>
                  <div className="content-main-copy">
                    <span>{typeInfo.label} • {item.grade}</span>
                    <h3>{item.title}</h3>
                    <p>{item.unit} — {item.lesson}</p>
                    <small>{formatPages(item)} • {normalizeTags(item.tags).join(' • ') || 'بدون وسوم'}</small>
                  </div>
                  <div className="content-actions">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); editItem(item); }}><PencilLine size={16} /></button>
                    <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink size={16} /></a>
                    <button type="button" onClick={(e) => { e.stopPropagation(); pinForClass(item); }}><Sparkles size={16} /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
            {!filtered.length && <div className="panel empty-state content-empty-state"><BookOpen size={34} /><p>لا يوجد محتوى مطابق للفلترة.</p></div>}
          </div>
        </div>

        <aside className="content-preview-panel panel">
          {selected ? (
            <>
              <div className="preview-hero">
                <div className="content-icon-large"><SelectedIcon size={28} /></div>
                <div>
                  <span className="eyebrow">معاينة المورد</span>
                  <h3>{selected.title}</h3>
                  <p>{selected.grade} • {selected.unit} • {selected.lesson}</p>
                </div>
              </div>
              <div className="preview-meta-grid">
                <article><span>النوع</span><strong>{(resourceTypes[selected.type] || resourceTypes.link).label}</strong></article>
                <article><span>الصفحات</span><strong>{formatPages(selected)}</strong></article>
                <article><span>الخط الزمني</span><strong>{normalizeSequence(selected.sequence).length} خطوات</strong></article>
                <article><span>الحالة</span><strong>{String(selected.id) === String(data.settings?.classResourceId || '') ? 'مثبت في الحصة' : 'جاهز'}</strong></article>
              </div>
              <div className="preview-flow-strip">
                {normalizeSequence(selected.sequence).map((step) => <span key={step}>{flowLabels[step] || step}</span>)}
              </div>
              <div className="preview-notes">
                <h4>ملاحظات</h4>
                <p>{selected.notes || 'لا توجد ملاحظات محفوظة لهذا المورد.'}</p>
              </div>
              <div className="preview-tags">
                {normalizeTags(selected.tags).length ? normalizeTags(selected.tags).map((tag) => <span key={tag}>#{tag}</span>) : <span>#بدون_وسوم</span>}
              </div>
              <div className="preview-actions">
                <a className="primary-btn" href={selected.url} target="_blank" rel="noreferrer"><Eye size={16}/> فتح المورد</a>
                <button className="secondary-btn" onClick={() => editItem(selected)}><PencilLine size={16}/> تعديل</button>
                <button className="secondary-btn" onClick={() => pinForClass(selected)}><Sparkles size={16}/> تثبيت في الحصة</button>
              </div>
              <div className="preview-summary-box">
                <BookMarked size={18} />
                <div>
                  <strong>خطة الحصة المقترحة</strong>
                  <p>{normalizeSequence(selected.sequence).map((step) => flowLabels[step] || step).join(' • ')}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state"><BookOpen size={34} /><p>اختر موردًا من المكتبة لعرض تفاصيله هنا.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
