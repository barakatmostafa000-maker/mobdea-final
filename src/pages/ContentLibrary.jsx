import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  BookMarked,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  File,
  FileAudio,
  FileImage,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Map,
  Mic2,
  PencilLine,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from 'lucide-react';
import { generateQuestionsForLessonBundle, removeGeneratedQuestions, upsertGeneratedQuestions } from '../services/contentQuestions';
import { deleteAsset, storeAsset } from '../services/assetStore';
import { useAssetUrl } from '../hooks/useAssetUrl';
import {
  LIBRARY_KINDS,
  getAllLibraryGrades,
  getGradeExams,
  getGradeTextbook,
  getLessonMedia,
  getLessonModeResources,
  getLessonsForGrade,
  gradeResourceId,
  hasResourceSource,
  inferMediaType,
  librarySummary,
} from '../services/libraryModel';

const defaultGrade = 'الصف السادس الابتدائي';
const defaultSequence = ['preview', 'board', 'practice'];
const flowLabels = { preview: 'تمهيد', board: 'شرح على السبورة', practice: 'تدريب', quiz: 'تقويم سريع' };
const mediaLabels = {
  image: 'صورة',
  video: 'فيديو',
  audio: 'ملف صوتي',
  pdf: 'مستند PDF',
  file: 'ملف',
  document: 'مستند',
  slides: 'عرض PowerPoint',
  link: 'رابط',
  map: 'خريطة',
};

function createLessonForm(grade = defaultGrade) {
  return {
    id: '',
    title: '',
    grade,
    term: 'الترم الأول',
    unit: '',
    lessonDate: new Date().toISOString().slice(0, 10),
    pageStart: 1,
    pageEnd: 1,
    notes: '',
    homework: '',
    tags: '',
    sequence: [...defaultSequence],
    thumbnailAssetId: '',
    thumbnailFileName: '',
    recordingAssetId: '',
    recordingFileName: '',
    mapState: null,
  };
}

function formatSize(bytes = 0) {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function MediaIcon({ type, size = 20 }) {
  const Icon = type === 'image' ? FileImage
    : type === 'video' ? Film
      : type === 'audio' ? FileAudio
        : type === 'pdf' || type === 'textbook' || type === 'exams' || type === 'document' ? FileText
          : File;
  return <Icon size={size} />;
}

function AssetAction({ resource, label = 'فتح الملف', className = 'secondary-btn' }) {
  const url = useAssetUrl(resource?.assetId, resource?.url);
  if (!url) return null;
  return <a className={className} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{label}</a>;
}

function LessonThumbnail({ lesson }) {
  const url = useAssetUrl(lesson?.thumbnailAssetId, lesson?.thumbnailUrl);
  return (
    <div className="library-lesson-thumbnail">
      {url ? <img src={url} alt={lesson?.title || 'صورة الدرس'} /> : <BookOpen size={28}/>}
    </div>
  );
}

function LessonAccessAction({ data, lesson, canManage, onOpenLessonMode, onOpenViewer }) {
  const resources = getLessonModeResources(data, lesson.grade, lesson.id);
  if (canManage) return <button className="primary-btn" type="button" onClick={onOpenLessonMode}><Sparkles size={15}/> فتح الحصة</button>;
  if (resources.length) return <button className="primary-btn" type="button" onClick={onOpenViewer}><PlayCircle size={15}/> عرض محتوى الدرس</button>;
  return <span className="library-content-unavailable">لا يوجد ملف متاح للعرض</span>;
}

function StudentLessonResource({ resource }) {
  const url = useAssetUrl(resource?.assetId, resource?.url);
  if (!resource) return <div className="empty-state">لا يوجد محتوى في هذا الدرس.</div>;
  if (!url) return <div className="empty-state"><File size={34}/><strong>{resource.title}</strong><span>الملف غير متاح على هذا الجهاز أو لم تتم مزامنته بعد.</span></div>;
  if (resource.type === 'image') return <img className="student-lesson-media" src={url} alt={resource.title}/>;
  if (resource.type === 'video') return <video className="student-lesson-media" controls playsInline src={url}/>;
  if (resource.type === 'audio') return <audio className="student-lesson-audio" controls src={url}/>;
  if (['pdf', 'textbook'].includes(resource.type)) return <iframe className="student-lesson-document" title={resource.title} src={`${url}#toolbar=1&navpanes=0`}/>;
  return <div className="student-lesson-file-fallback"><MediaIcon type={resource.type} size={44}/><strong>{resource.title}</strong><small>{resource.fileName || resource.mimeType || mediaLabels[resource.type] || 'ملف الدرس'}</small><a className="primary-btn" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> فتح الملف</a></div>;
}

function StudentLessonViewer({ data, lesson, index, onIndex, onClose }) {
  const resources = getLessonModeResources(data, lesson?.grade, lesson?.id);
  const safeIndex = resources.length ? Math.max(0, Math.min(index, resources.length - 1)) : 0;
  const resource = resources[safeIndex] || null;
  return <div className="student-lesson-viewer-backdrop" role="presentation" onClick={onClose}>
    <section className="student-lesson-viewer" role="dialog" aria-modal="true" aria-label={`محتوى ${lesson?.title || 'الدرس'}`} onClick={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">محتوى الدرس</span><h2>{lesson?.title}</h2><small>{resource?.title || 'لا يوجد ملف'} {resources.length ? `— ${safeIndex + 1} من ${resources.length}` : ''}</small></div><button className="icon-action" type="button" onClick={onClose} aria-label="إغلاق"><X/></button></header>
      <div className="student-lesson-viewer-stage"><StudentLessonResource resource={resource}/></div>
      <footer>
        <button className="secondary-btn" type="button" disabled={resources.length < 2} onClick={() => onIndex((safeIndex - 1 + resources.length) % resources.length)}><ChevronRight size={17}/> السابق</button>
        <div className="student-lesson-resource-tabs">{resources.map((item, itemIndex) => <button key={item.id} className={itemIndex === safeIndex ? 'active' : ''} type="button" onClick={() => onIndex(itemIndex)} title={item.title}><MediaIcon type={item.type} size={16}/><span>{item.title}</span></button>)}</div>
        <button className="secondary-btn" type="button" disabled={resources.length < 2} onClick={() => onIndex((safeIndex + 1) % resources.length)}>التالي <ChevronLeft size={17}/></button>
      </footer>
    </section>
  </div>;
}

function PermanentCard({ kind, resource, grade, canManage, busy, onUpload, onRemove }) {
  const isTextbook = kind === LIBRARY_KINDS.GRADE_TEXTBOOK;
  const Icon = isTextbook ? BookOpen : BookMarked;
  const title = isTextbook ? 'كتاب المنهج الرئيسي' : 'ملف الامتحانات الرئيسي';
  const description = isTextbook
    ? 'كتاب واحد دائم للصف؛ يستخدمه وضع الحصة تلقائيًا ولا يُطلب رفعه داخل كل درس.'
    : 'مرجع دائم لبنك الأسئلة ومولد الامتحانات والمساعد الذكي.';
  return (
    <article className={`library-permanent-card ${hasResourceSource(resource || {}) ? 'ready' : 'missing'}`}>
      <div className="library-permanent-icon"><Icon size={30}/></div>
      <div className="library-permanent-copy">
        <span className="eyebrow">{grade}</span>
        <h3>{title}</h3>
        <p>{description}</p>
        {resource ? <small>{resource.fileName || resource.title} {resource.fileSize ? `• ${formatSize(resource.fileSize)}` : ''}</small> : <small>لم يُرفع ملف لهذا الصف بعد.</small>}
      </div>
      <div className="library-permanent-actions">
        <AssetAction resource={resource} label="فتح" />
        {canManage && <button className="primary-btn" type="button" disabled={busy} onClick={onUpload}><Upload size={16}/>{resource ? 'استبدال PDF' : 'رفع PDF'}</button>}
        {canManage && resource && <button className="icon-action danger-text" type="button" disabled={busy} onClick={onRemove} title="إزالة الملف مع إبقاء البطاقة"><Trash2 size={16}/></button>}
      </div>
    </article>
  );
}

export default function ContentLibrary({ data, updateData, auth, navigate }) {
  const canManage = !auth || ['admin', 'teacher'].includes(auth.role);
  const grades = useMemo(() => getAllLibraryGrades(data), [data]);
  const studentRecord = useMemo(() => {
    if (auth?.role !== 'student') return null;
    return (data.students || []).find((item) => Number(item.id) === Number(auth.studentId))
      || (data.students || []).find((item) => String(item.code) === String(auth.studentCode || ''))
      || null;
  }, [auth?.role, auth?.studentCode, auth?.studentId, data.students]);
  const visibleGrades = useMemo(() => {
    if (auth?.role !== 'student') return grades;
    return studentRecord?.grade ? [studentRecord.grade] : grades.slice(0, 1);
  }, [auth?.role, grades, studentRecord?.grade]);
  const [selectedGrade, setSelectedGrade] = useState(studentRecord?.grade || data.settings?.libraryGrade || grades.find((item) => item === defaultGrade) || grades[0] || defaultGrade);
  const [expandedGrades, setExpandedGrades] = useState(() => new Set([selectedGrade]));
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(() => createLessonForm(selectedGrade));
  const [pendingMedia, setPendingMedia] = useState([]);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);
  const [replacedAssetIds, setReplacedAssetIds] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewerLessonId, setViewerLessonId] = useState('');
  const [viewerIndex, setViewerIndex] = useState(0);
  const textbookInputRef = useRef(null);
  const examsInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const recordingInputRef = useRef(null);

  useEffect(() => {
    if (auth?.role === 'student' && studentRecord?.grade && selectedGrade !== studentRecord.grade) {
      setSelectedGrade(studentRecord.grade);
      setExpandedGrades(new Set([studentRecord.grade]));
    }
  }, [auth?.role, selectedGrade, studentRecord?.grade]);

  const summary = useMemo(() => librarySummary(data), [data]);
  const selectedTextbook = useMemo(() => getGradeTextbook(data, selectedGrade), [data, selectedGrade]);
  const selectedExams = useMemo(() => getGradeExams(data, selectedGrade), [data, selectedGrade]);
  const editingMedia = useMemo(() => form.id ? getLessonMedia(data, form.id).filter((item) => !removedMediaIds.includes(String(item.id))) : [], [data, form.id, removedMediaIds]);

  const cleanupPending = async () => {
    await Promise.all(pendingMedia.map((item) => deleteAsset(item.assetId).catch(() => {})));
    const current = (data.contentLibrary || []).find((item) => String(item.id) === String(form.id));
    const keep = new Set([current?.thumbnailAssetId, current?.recordingAssetId].filter(Boolean).map(String));
    const stagedSpecial = [form.thumbnailAssetId, form.recordingAssetId]
      .filter((id) => id && !keep.has(String(id)));
    await Promise.all([...replacedAssetIds, ...stagedSpecial]
      .filter((id, index, list) => id && !keep.has(String(id)) && list.indexOf(id) === index)
      .map((id) => deleteAsset(id).catch(() => {})));
  };

  const closeEditor = async () => {
    await cleanupPending();
    setPendingMedia([]);
    setRemovedMediaIds([]);
    setReplacedAssetIds([]);
    setEditorOpen(false);
    setForm(createLessonForm(selectedGrade));
    setNotice('');
  };

  const openCreateLesson = (grade = selectedGrade) => {
    setSelectedGrade(grade);
    setExpandedGrades((current) => new Set([...current, grade]));
    setForm(createLessonForm(grade));
    setPendingMedia([]);
    setRemovedMediaIds([]);
    setReplacedAssetIds([]);
    setEditorOpen(true);
    setNotice(getGradeTextbook(data, grade) ? 'سيستخدم الدرس كتاب الصف الرئيسي تلقائيًا.' : 'تنبيه: ارفع كتاب الصف الرئيسي قبل فتح صفحات الدرس داخل وضع الحصة.');
  };

  const openEditLesson = (lesson) => {
    setSelectedGrade(lesson.grade);
    setForm({
      ...createLessonForm(lesson.grade),
      ...lesson,
      tags: normalizeTags(lesson.tags).join(', '),
      sequence: Array.isArray(lesson.sequence) && lesson.sequence.length ? lesson.sequence : [...defaultSequence],
      pageStart: lesson.pageStart || 1,
      pageEnd: lesson.pageEnd || lesson.pageStart || 1,
    });
    setPendingMedia([]);
    setRemovedMediaIds([]);
    setReplacedAssetIds([]);
    setEditorOpen(true);
    setNotice('يمكن تعديل بيانات الدرس وإضافة وسائط جديدة دون إعادة رفع كتاب المنهج.');
  };

  const replaceFormAsset = async (file, type) => {
    if (!file) return;
    setBusy(true);
    try {
      const isThumbnail = type === 'thumbnail';
      if (isThumbnail && !String(file.type || '').startsWith('image/')) throw new Error('الصورة المصغرة يجب أن تكون ملف صورة.');
      if (type === 'recording' && !String(file.type || '').startsWith('audio/') && !String(file.type || '').startsWith('video/')) throw new Error('تسجيل الدرس يجب أن يكون صوتًا أو فيديو.');
      const asset = await storeAsset(file, { name: file.name, type: file.type, kind: `lesson-${type}` });
      const idField = isThumbnail ? 'thumbnailAssetId' : 'recordingAssetId';
      const nameField = isThumbnail ? 'thumbnailFileName' : 'recordingFileName';
      if (form[idField]) setReplacedAssetIds((current) => [...current, form[idField]]);
      setForm((current) => ({ ...current, [idField]: asset.id, [nameField]: asset.name }));
      setNotice(`تم تجهيز ${isThumbnail ? 'الصورة المصغرة' : 'تسجيل الدرس'} للحفظ.`);
    } catch (error) {
      setNotice(error?.message || 'تعذر حفظ الملف.');
    } finally {
      setBusy(false);
    }
  };

  const stageLessonMedia = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    setBusy(true);
    const staged = [];
    try {
      for (const file of list) {
        const mediaType = inferMediaType(file);
        const asset = await storeAsset(file, { name: file.name, type: file.type, kind: 'lesson-media' });
        staged.push({
          id: `lesson-media:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          kind: LIBRARY_KINDS.LESSON_MEDIA,
          type: mediaType,
          title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          assetId: asset.id,
          fileName: asset.name,
          mimeType: asset.type,
          fileSize: asset.size,
          notes: '',
          order: editingMedia.length + pendingMedia.length + staged.length,
        });
      }
      setPendingMedia((current) => [...current, ...staged]);
      setNotice(`تم تجهيز ${staged.length} ملف/ملفات لإضافتها إلى الدرس.`);
    } catch (error) {
      await Promise.all(staged.map((item) => deleteAsset(item.assetId).catch(() => {})));
      setNotice(error?.message || 'تعذر تجهيز وسائط الدرس.');
    } finally {
      setBusy(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const uploadPermanent = async (kind, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !String(file.name || '').toLowerCase().endsWith('.pdf')) {
      setNotice('الكتاب وملف الامتحانات يجب أن يكونا بصيغة PDF.');
      return;
    }
    setBusy(true);
    let created;
    try {
      created = await storeAsset(file, { name: file.name, type: file.type || 'application/pdf', kind });
      const old = kind === LIBRARY_KINDS.GRADE_TEXTBOOK ? getGradeTextbook(data, selectedGrade) : getGradeExams(data, selectedGrade);
      const now = new Date().toISOString();
      const resource = {
        ...(old || {}),
        id: old?.id || gradeResourceId(kind, selectedGrade),
        kind,
        type: kind === LIBRARY_KINDS.GRADE_TEXTBOOK ? 'textbook' : 'exams',
        permanent: true,
        title: `${kind === LIBRARY_KINDS.GRADE_TEXTBOOK ? 'كتاب المنهج الرئيسي' : 'ملف الامتحانات الرئيسي'} — ${selectedGrade}`,
        grade: selectedGrade,
        term: old?.term || '',
        unit: '',
        lesson: '',
        assetId: created.id,
        url: '',
        fileName: created.name,
        mimeType: created.type,
        fileSize: created.size,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      const contentLibrary = old
        ? (data.contentLibrary || []).map((item) => String(item.id) === String(old.id) ? resource : item)
        : [...(data.contentLibrary || []), resource];
      await updateData({ ...data, contentLibrary, settings: { ...data.settings, libraryGrade: selectedGrade } });
      if (old?.assetId && old.assetId !== created.id) await deleteAsset(old.assetId).catch(() => {});
      setNotice(`تم حفظ ${resource.title} بصورة دائمة.`);
    } catch (error) {
      if (created?.id) await deleteAsset(created.id).catch(() => {});
      setNotice(error?.message || 'تعذر حفظ ملف الصف.');
    } finally {
      setBusy(false);
      if (textbookInputRef.current) textbookInputRef.current.value = '';
      if (examsInputRef.current) examsInputRef.current.value = '';
    }
  };

  const removePermanentFile = async (kind) => {
    const resource = kind === LIBRARY_KINDS.GRADE_TEXTBOOK ? selectedTextbook : selectedExams;
    if (!resource) return;
    const contentLibrary = (data.contentLibrary || []).map((item) => String(item.id) === String(resource.id)
      ? { ...item, assetId: '', url: '', fileName: '', mimeType: '', fileSize: 0, updatedAt: new Date().toISOString() }
      : item);
    await updateData({ ...data, contentLibrary });
    if (resource.assetId) await deleteAsset(resource.assetId).catch(() => {});
    setNotice('تمت إزالة الملف، وستظل البطاقة الدائمة متاحة لرفع بديل.');
  };

  const saveLesson = async () => {
    if (!form.title.trim() || !form.grade.trim()) {
      setNotice('اكتب اسم الدرس وحدد الصف.');
      return;
    }
    const pageStart = Math.max(1, Number(form.pageStart || 1));
    const pageEnd = Math.max(pageStart, Number(form.pageEnd || pageStart));
    setBusy(true);
    const now = new Date().toISOString();
    const lessonId = form.id || `lesson:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const existing = (data.contentLibrary || []).find((item) => String(item.id) === String(lessonId));
    const lesson = {
      ...(existing || {}),
      id: lessonId,
      kind: LIBRARY_KINDS.LESSON,
      type: 'lesson',
      title: form.title.trim(),
      lesson: form.title.trim(),
      grade: form.grade.trim(),
      term: form.term.trim(),
      unit: form.unit.trim(),
      lessonDate: form.lessonDate || '',
      pageStart,
      pageEnd,
      notes: form.notes.trim(),
      homework: form.homework.trim(),
      tags: normalizeTags(form.tags),
      sequence: form.sequence.length ? form.sequence : [...defaultSequence],
      thumbnailAssetId: form.thumbnailAssetId || '',
      thumbnailFileName: form.thumbnailFileName || '',
      recordingAssetId: form.recordingAssetId || '',
      recordingFileName: form.recordingFileName || '',
      mapState: form.mapState || existing?.mapState || null,
      permanent: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const removedSet = new Set(removedMediaIds.map(String));
    const keptItems = (data.contentLibrary || []).filter((item) => !removedSet.has(String(item.id)));
    const withLesson = existing
      ? keptItems.map((item) => String(item.id) === String(lessonId) ? lesson : item)
      : [...keptItems, lesson];
    const mediaRecords = pendingMedia.map((item, index) => ({
      ...item,
      lessonId,
      parentLessonId: lessonId,
      grade: lesson.grade,
      term: lesson.term,
      unit: lesson.unit,
      lesson: lesson.title,
      order: editingMedia.length + index,
      createdAt: item.createdAt || now,
      updatedAt: now,
    }));
    const examSource = getGradeExams(data, lesson.grade);
    const generated = generateQuestionsForLessonBundle({
      ...lesson,
      sourceExamResourceId: examSource?.id || '',
      sourceExamAssetId: examSource?.assetId || '',
      sourceExamFileName: examSource?.fileName || '',
    }, [...editingMedia, ...mediaRecords]);
    const customQuestionBank = upsertGeneratedQuestions(data.customQuestionBank || [], lesson, generated);
    try {
      const textbook = getGradeTextbook(data, lesson.grade);
      const classResources = [
        ...(textbook && hasResourceSource(textbook)
          ? [{
              id: `lesson-textbook:${lesson.id}`,
              title: `${lesson.title} — كتاب المنهج`,
              type: 'textbook',
              lessonId: lesson.id,
            }]
          : []),
        ...mediaRecords.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          lessonId: lesson.id,
        })),
        ...editingMedia.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          lessonId: lesson.id,
        })),
      ];
      await updateData({
        ...data,
        contentLibrary: [...withLesson, ...mediaRecords],
        customQuestionBank,
        settings: {
          ...data.settings,
          libraryGrade: lesson.grade,
          classLessonId: lesson.id,
          classResourceId: classResources[0]?.id || '',
          classResourceQueue: classResources,
        },
      });
      const removedAssets = (data.contentLibrary || [])
        .filter((item) => removedSet.has(String(item.id)))
        .map((item) => item.assetId)
        .filter(Boolean);
      const oldAssets = replacedAssetIds.filter((id) => id && id !== lesson.thumbnailAssetId && id !== lesson.recordingAssetId);
      await Promise.all([...removedAssets, ...oldAssets].map((id) => deleteAsset(id).catch(() => {})));
      setPendingMedia([]);
      setRemovedMediaIds([]);
      setReplacedAssetIds([]);
      setForm(createLessonForm(lesson.grade));
      setSelectedGrade(lesson.grade);
      setExpandedGrades((current) => new Set([...current, lesson.grade]));
      setEditorOpen(false);
      setNotice('تم حفظ الدرس ووسائطه وربطه بوضع الحصة، وإنشاء مسودة أسئلة وألعاب تلقائية قابلة للمراجعة.');
    } catch (error) {
      setNotice(error?.message || 'تعذر حفظ الدرس.');
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async (lesson) => {
    const media = getLessonMedia(data, lesson.id);
    const ids = new Set([String(lesson.id), ...media.map((item) => String(item.id))]);
    const assets = [lesson.thumbnailAssetId, lesson.recordingAssetId, ...media.map((item) => item.assetId)].filter(Boolean);
    const contentLibrary = (data.contentLibrary || []).filter((item) => !ids.has(String(item.id)));
    let customQuestionBank = removeGeneratedQuestions(data.customQuestionBank || [], lesson.id);
    for (const item of media) customQuestionBank = removeGeneratedQuestions(customQuestionBank, item.id);
    const settings = String(data.settings?.classLessonId) === String(lesson.id)
      ? { ...data.settings, classLessonId: '', classResourceId: '', classResourceQueue: [] }
      : data.settings;
    await updateData({ ...data, contentLibrary, customQuestionBank, settings });
    await Promise.all(assets.map((id) => deleteAsset(id).catch(() => {})));
    setNotice(`تم حذف درس «${lesson.title}» ووسائطه فقط.`);
  };

  const openInLessonMode = async (lesson) => {
    const resources = getLessonModeResources(data, lesson.grade, lesson.id);
    await updateData({
      ...data,
      settings: {
        ...data.settings,
        classLessonId: lesson.id,
        classResourceId: resources[0]?.id || '',
        classResourceQueue: resources.map((item) => ({ id: item.id, title: item.title, type: item.type, lessonId: lesson.id })),
        libraryGrade: lesson.grade,
      },
    });
    setNotice(resources.length ? 'تم تجهيز الدرس وكتابه ووسائطه في وضع الحصة.' : 'تم تجهيز الدرس؛ ارفع كتاب الصف أو وسائطه لإظهار المحتوى.');
    navigate?.('classMode');
  };

  const toggleSequence = (key) => setForm((current) => ({
    ...current,
    sequence: current.sequence.includes(key) ? current.sequence.filter((item) => item !== key) : [...current.sequence, key],
  }));

  const filteredLessons = (grade) => {
    const query = search.trim().toLowerCase();
    return getLessonsForGrade(data, grade).filter((lesson) => !query || [lesson.title, lesson.unit, lesson.notes, ...normalizeTags(lesson.tags)].join(' ').toLowerCase().includes(query));
  };

  return (
    <section className="page content-page library-system-page library-v103">
      <input ref={textbookInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void uploadPermanent(LIBRARY_KINDS.GRADE_TEXTBOOK, event.target.files?.[0])}/>
      <input ref={examsInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void uploadPermanent(LIBRARY_KINDS.GRADE_EXAMS, event.target.files?.[0])}/>
      <input ref={mediaInputRef} type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.pps,.ppsx,.odp,.xls,.xlsx,.txt" onChange={(event) => void stageLessonMedia(event.target.files)}/>
      <input ref={thumbnailInputRef} type="file" accept="image/*" hidden onChange={(event) => void replaceFormAsset(event.target.files?.[0], 'thumbnail')}/>
      <input ref={recordingInputRef} type="file" accept="audio/*,video/*" hidden onChange={(event) => void replaceFormAsset(event.target.files?.[0], 'recording')}/>

      <div className="page-heading library-heading">
        <div><span className="eyebrow">المصدر الموحد للمحتوى</span><h2>المكتبة وإدارة الدروس</h2><p>الكتاب والامتحانات والدروس ووسائطها تُدار من هنا، وتفتح تلقائيًا داخل وضع الحصة.</p></div>
        <div className="library-heading-actions">
          <label>الصف النشط<select value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setExpandedGrades((current) => new Set([...current, event.target.value])); }}>
            {visibleGrades.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          {canManage && <button className="primary-btn" type="button" onClick={() => openCreateLesson(selectedGrade)}><Plus size={17}/> درس جديد</button>}
        </div>
      </div>

      <div className="library-summary-strip">
        <article><BookOpen/><span>كتب جاهزة</span><strong>{summary.textbooks}</strong></article>
        <article><BookMarked/><span>ملفات امتحانات</span><strong>{summary.exams}</strong></article>
        <article><CalendarDays/><span>الدروس</span><strong>{summary.lessons}</strong></article>
        <article><FolderOpen/><span>وسائط الدروس</span><strong>{summary.media}</strong></article>
      </div>

      <div className="library-permanent-grid">
        <PermanentCard kind={LIBRARY_KINDS.GRADE_TEXTBOOK} resource={selectedTextbook} grade={selectedGrade} canManage={canManage} busy={busy} onUpload={() => textbookInputRef.current?.click()} onRemove={() => void removePermanentFile(LIBRARY_KINDS.GRADE_TEXTBOOK)}/>
        <PermanentCard kind={LIBRARY_KINDS.GRADE_EXAMS} resource={selectedExams} grade={selectedGrade} canManage={canManage} busy={busy} onUpload={() => examsInputRef.current?.click()} onRemove={() => void removePermanentFile(LIBRARY_KINDS.GRADE_EXAMS)}/>
      </div>

      {notice && <div className="settings-notice library-notice">{notice}</div>}

      <div className="library-search-bar"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الدرس أو الوحدة أو الملاحظات"/><span>{summary.lessons} درس</span></div>

      <div className="library-grade-accordions">
        {visibleGrades.map((grade) => {
          const opened = expandedGrades.has(grade);
          const lessons = filteredLessons(grade);
          const textbook = getGradeTextbook(data, grade);
          const exams = getGradeExams(data, grade);
          return (
            <section className={`library-grade-section ${opened ? 'open' : ''}`} key={grade}>
              <div className="library-grade-header">
                <button className="library-grade-toggle" type="button" aria-expanded={opened} onClick={() => setExpandedGrades((current) => { const next = new Set(current); if (next.has(grade)) next.delete(grade); else next.add(grade); return next; })}>
                  <div className="library-grade-title"><span>{opened ? <ChevronUp/> : <ChevronDown/>}</span><div><strong>{grade}</strong><small>{lessons.length} درس • الكتاب {hasResourceSource(textbook || {}) ? 'جاهز' : 'غير مرفوع'} • الامتحانات {hasResourceSource(exams || {}) ? 'جاهزة' : 'غير مرفوعة'}</small></div></div>
                </button>
                {canManage && <button className="library-grade-add" type="button" onClick={() => openCreateLesson(grade)}><Plus size={16}/> إضافة درس</button>}
              </div>
              {opened && <div className="library-lessons-grid">
                {lessons.map((lesson) => {
                  const media = getLessonMedia(data, lesson.id);
                  return (
                    <article className="library-lesson-card" key={lesson.id}>
                      <LessonThumbnail lesson={lesson}/>
                      <div className="library-lesson-main">
                        <span className="eyebrow">{lesson.unit || 'بدون وحدة'} {lesson.lessonDate ? `• ${lesson.lessonDate}` : ''}</span>
                        <h3>{lesson.title}</h3>
                        <p>{lesson.notes || 'لا توجد ملاحظات للدرس.'}{lesson.homework ? ` • الواجب: ${lesson.homework}` : ''}</p>
                        <div className="library-lesson-meta"><span><FileText size={14}/> ص {lesson.pageStart || 1}–{lesson.pageEnd || lesson.pageStart || 1}</span><span><FolderOpen size={14}/> {media.length} وسائط</span><span><Map size={14}/> {lesson.mapState ? 'خريطة محفوظة' : 'خريطة تلقائية'}</span></div>
                        <div className="library-media-chips">{media.slice(0, 6).map((item) => <span key={item.id}><MediaIcon type={item.type} size={13}/>{item.title}</span>)}{media.length > 6 && <span>+{media.length - 6}</span>}</div>
                      </div>
                      <div className="library-lesson-actions">
                        <LessonAccessAction data={data} lesson={lesson} canManage={canManage} onOpenLessonMode={() => void openInLessonMode(lesson)} onOpenViewer={() => { setViewerLessonId(lesson.id); setViewerIndex(0); }}/>
                        {canManage && <button className="secondary-btn" type="button" onClick={() => openEditLesson(lesson)}><PencilLine size={15}/> تعديل</button>}
                        {canManage && <button className="icon-action danger-text" type="button" onClick={() => void deleteLesson(lesson)} title="حذف الدرس"><Trash2 size={16}/></button>}
                      </div>
                    </article>
                  );
                })}
                {!lessons.length && <div className="empty-state library-empty-grade"><BookOpen size={32}/><p>{search ? 'لا يوجد درس مطابق للبحث في هذا الصف.' : 'لا توجد دروس في هذا الصف بعد.'}</p>{canManage && <button className="secondary-btn" type="button" onClick={() => openCreateLesson(grade)}><Plus size={15}/> إنشاء أول درس</button>}</div>}
              </div>}
            </section>
          );
        })}
      </div>

      {viewerLessonId && <StudentLessonViewer
        data={data}
        lesson={(data.contentLibrary || []).find((item) => String(item.id) === String(viewerLessonId))}
        index={viewerIndex}
        onIndex={setViewerIndex}
        onClose={() => { setViewerLessonId(''); setViewerIndex(0); }}
      />}

      {editorOpen && <div className="library-editor-backdrop" role="presentation" onClick={() => void closeEditor()}>
        <aside className="library-lesson-editor" role="dialog" aria-modal="true" aria-label="محرر الدرس" onClick={(event) => event.stopPropagation()}>
          <header><div><span className="eyebrow">{form.id ? 'تعديل الدرس' : 'درس جديد'}</span><h2>{form.title || 'إنشاء محتوى الدرس'}</h2><p>الكتاب الرئيسي للصف يُستخدم تلقائيًا؛ حدد الصفحات وأرفق الوسائط فقط.</p></div><button className="icon-action" type="button" onClick={() => void closeEditor()}><X/></button></header>
          <div className="library-editor-textbook-state"><BookOpen size={22}/><div><strong>{getGradeTextbook(data, form.grade)?.fileName || `كتاب ${form.grade} غير مرفوع`}</strong><small>{getGradeTextbook(data, form.grade) ? 'سيظهر تلقائيًا في الحصة ضمن نطاق الصفحات المحدد.' : 'يمكن حفظ الدرس الآن، لكن يجب رفع الكتاب من بطاقته الدائمة.'}</small></div></div>
          <div className="library-editor-grid">
            <label className="span-2">اسم الدرس<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="مثال: مفهوم الدولة وعناصرها"/></label>
            <label>الصف<select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>تاريخ الدرس<input type="date" value={form.lessonDate || ''} onChange={(event) => setForm({ ...form, lessonDate: event.target.value })}/></label>
            <label>الترم<input value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}/></label>
            <label>الوحدة<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="الوحدة الأولى"/></label>
            <label>الصفحات من<input type="number" min="1" value={form.pageStart} onChange={(event) => setForm({ ...form, pageStart: event.target.value })}/></label>
            <label>الصفحات إلى<input type="number" min={form.pageStart || 1} value={form.pageEnd} onChange={(event) => setForm({ ...form, pageEnd: event.target.value })}/></label>
            <label className="span-2">ملاحظات الدرس<textarea rows="4" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="أهداف الدرس والنقاط المهمة وخطة الشرح..."/></label>
            <label className="span-2">الواجب المنزلي<textarea rows="3" value={form.homework || ''} onChange={(event) => setForm({ ...form, homework: event.target.value })} placeholder="اكتب واجب الدرس؛ سيظهر في تسجيل الحصة والتقارير."/></label>
            <label className="span-2">الوسوم<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="مصر، خريطة، حضارة"/></label>
          </div>

          <section className="library-editor-section"><div className="library-editor-section-head"><div><strong>خط سير الحصة</strong><small>يظهر بنفس الترتيب داخل وضع الحصة.</small></div></div><div className="library-sequence-row">{Object.entries(flowLabels).map(([key, label]) => <button key={key} type="button" className={form.sequence.includes(key) ? 'active' : ''} onClick={() => toggleSequence(key)}>{label}</button>)}</div></section>

          <section className="library-editor-section">
            <div className="library-editor-section-head"><div><strong>وسائط الدرس الدائمة</strong><small>صور، فيديو، صوت، PDF، PowerPoint ومستندات؛ تُربط تلقائيًا بالدرس وتظهر في وضع الحصة.</small></div><button className="secondary-btn" type="button" disabled={busy} onClick={() => mediaInputRef.current?.click()}><Plus size={15}/> إضافة ملفات</button></div>
            <div className="library-editor-media-grid">
              {[...editingMedia, ...pendingMedia].map((item) => {
                const pending = pendingMedia.some((entry) => String(entry.id) === String(item.id));
                return <article key={item.id}><span className="library-editor-media-icon"><MediaIcon type={item.type}/></span><div><strong>{item.title}</strong><small>{mediaLabels[item.type] || 'ملف'} {item.fileSize ? `• ${formatSize(item.fileSize)}` : ''}</small></div><button className="icon-action danger-text" type="button" onClick={() => { if (pending) { setPendingMedia((current) => current.filter((entry) => String(entry.id) !== String(item.id))); deleteAsset(item.assetId).catch(() => {}); } else setRemovedMediaIds((current) => [...current, String(item.id)]); }}><Trash2 size={15}/></button></article>;
              })}
              {!editingMedia.length && !pendingMedia.length && <div className="library-editor-empty-media"><FolderOpen size={28}/><span>لا توجد وسائط بعد.</span></div>}
            </div>
          </section>

          <section className="library-editor-section library-special-assets"><div><ImageIcon size={20}/><span><strong>صورة الدرس المصغرة</strong><small>{form.thumbnailFileName || 'اختيارية وتظهر في المكتبة.'}</small></span><button className="secondary-btn" type="button" onClick={() => thumbnailInputRef.current?.click()}><Upload size={15}/> {form.thumbnailAssetId ? 'استبدال' : 'رفع'}</button></div><div><Mic2 size={20}/><span><strong>تسجيل الدرس</strong><small>{form.recordingFileName || 'صوت أو فيديو محفوظ مع الدرس.'}</small></span><button className="secondary-btn" type="button" onClick={() => recordingInputRef.current?.click()}><Upload size={15}/> {form.recordingAssetId ? 'استبدال' : 'رفع'}</button></div></section>

          {notice && <div className="settings-notice">{notice}</div>}
          <footer><button className="secondary-btn" type="button" onClick={() => void closeEditor()}>إلغاء</button><button className="primary-btn" type="button" disabled={busy} onClick={() => void saveLesson()}><Save size={16}/>{busy ? 'جارٍ الحفظ...' : 'حفظ الدرس وكل محتواه'}</button></footer>
        </aside>
      </div>}
    </section>
  );
}
