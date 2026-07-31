import { BookOpen, Gamepad2, Link as LinkIcon, QrCode, Users, CalendarClock, Sparkles, Target, AlertTriangle, LoaderCircle } from 'lucide-react';
import { identity } from '../config/identity';
import { normalizeSecureUrl } from '../utils/safety';
import StudentLiveRoom from '../components/live/StudentLiveRoom';
import StudentOnlineGameRoom from '../components/live/StudentOnlineGameRoom';

function safeSharedUrl(value, type = '') {
  return normalizeSecureUrl(value, {
    allowRelative: true,
    allowData: true,
    allowedDataTypes: type === 'pdf' ? /^application\/pdf$/i : /^(image|audio|video)\//i,
  });
}

function ResourcePreview({ resource, boardImage }) {
  if (!resource) return <div className="shared-placeholder">لا يوجد مورد مرتبط بعد.</div>;
  const resourceUrl = safeSharedUrl(resource.url, resource.type);
  const safeBoardImage = safeSharedUrl(boardImage, 'image');
  return (
    <div className="shared-resource-preview panel">
      <div className="shared-resource-head">
        <div>
          <span className="eyebrow">{resource.type || 'مورد'}</span>
          <h3>{resource.title}</h3>
          <p>{resource.unit || '—'} • {resource.lesson || '—'}</p>
        </div>
        <span className="shared-resource-badge">{resource.grade || 'الصف'}</span>
      </div>
      <div className="shared-resource-body">
        {resource.type === 'image' && resourceUrl && <img src={resourceUrl} alt={resource.title} />}
        {resource.type === 'video' && resourceUrl && <video src={resourceUrl} controls />}
        {resource.type === 'audio' && resourceUrl && <audio src={resourceUrl} controls />}
        {resource.type === 'pdf' && resourceUrl && <iframe title={resource.title} src={resourceUrl} sandbox="allow-same-origin" />}
        {!resourceUrl && <div className="shared-placeholder">{resource.fileName || resource.notes || 'المورد غير متاح في هذا الرابط.'}</div>}
        {safeBoardImage && <div className="shared-board-image"><img src={safeBoardImage} alt="لوحة الحصة" /></div>}
      </div>
    </div>
  );
}

export default function SharedAccess({ shareKind, sharePayload, shareLoading = false, shareError = '', onGoHome }) {
  if (shareKind === 'live' && sharePayload) {
    if (sharePayload.experience === 'game') {
      return <StudentOnlineGameRoom payload={sharePayload} onGoHome={onGoHome} />;
    }
    return <StudentLiveRoom payload={sharePayload} onGoHome={onGoHome} />;
  }
  if (shareLoading) {
    return <section className="page shared-access-page"><div className="shared-shell"><article className="panel shared-hero"><LoaderCircle className="spin" size={28} /><div><h2>جارٍ فتح رابط المشاركة</h2><p>يتم التحقق من الرابط وتحميل المحتوى الآمن.</p></div></article></div></section>;
  }
  if (shareError || !sharePayload) {
    return <section className="page shared-access-page"><div className="shared-shell"><article className="panel shared-hero"><AlertTriangle size={28} /><div><h2>تعذر فتح الرابط</h2><p>{shareError || 'الرابط غير صالح أو انتهت صلاحيته.'}</p></div><button className="primary-btn" onClick={onGoHome} type="button">العودة للمنصة</button></article></div></section>;
  }

  const payload = sharePayload || {};
  const session = payload.session || payload.lesson || null;
  const resource = payload.resource || payload.selectedResource || null;
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const players = Array.isArray(payload.players) ? payload.players : [];
  const challengePlayers = Array.isArray(payload.challengePlayers) ? payload.challengePlayers : [];
  const boardActions = Array.isArray(payload.boardActions) ? payload.boardActions : [];
  const summaryPoints = [
    { label: 'الصف', value: payload.grade || session?.group || resource?.grade || '—' },
    { label: 'الوحدة', value: resource?.unit || payload.unit || '—' },
    { label: 'الدرس', value: resource?.lesson || payload.lessonTitle || session?.title || '—' },
    { label: 'العناصر', value: questions.length || boardActions.length || 0 },
  ];

  const title = shareKind === 'game' ? 'رابط التحدي المباشر' : 'رابط الطالب المباشر';
  const subtitle = shareKind === 'game'
    ? 'تم تجهيز تحدٍ مباشر من محتوى الحصة دون تضمين بيانات الدخول أو أرقام الهواتف.'
    : 'تم تجهيز المورد والسبورة والأنشطة التعليمية دون مشاركة بيانات الحسابات الخاصة.';

  return (
    <section className="page shared-access-page">
      <div className="shared-shell">
        <header className="shared-hero panel">
          <div className="shared-brand">
            <img src={identity.icon} alt={identity.schoolName} />
            <div><span className="eyebrow">منصة المُبدع</span><h2>{title}</h2><p>{subtitle}</p></div>
          </div>
          <div className="shared-actions"><button className="primary-btn" onClick={onGoHome} type="button"><LinkIcon size={16} /> العودة للمنصة</button></div>
        </header>

        <div className="shared-metrics-grid">
          {summaryPoints.map((item) => <article className="panel shared-metric-card" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}
        </div>

        <div className="shared-content-grid">
          <ResourcePreview resource={resource} boardImage={payload.boardImage} />
          <article className="panel shared-notes-card">
            <div className="panel-title"><div><span className="eyebrow">ملخص الحصة</span><h3>{session?.title || payload.lessonTitle || 'الشرح الحالي'}</h3></div><Sparkles size={18} /></div>
            <div className="shared-notes-box">{payload.summary || payload.notes || resource?.notes || 'لا توجد ملاحظات محفوظة.'}</div>
            <div className="shared-flow-strip">{(payload.flow || resource?.sequence || []).map((step) => <span key={step}>{step}</span>)}</div>
            <div className="shared-meta-row">
              <div><CalendarClock size={16} /><span>{payload.date || session?.day || '—'}</span></div>
              <div><Users size={16} /><span>{players.length ? players.map((player) => player.name || player.label).join(' • ') : 'لا يوجد لاعبون محددون'}</span></div>
              <div><QrCode size={16} /><span>{payload.mode || shareKind}</span></div>
            </div>
            {boardActions.length > 0 && <div className="shared-board-actions"><strong>ما حدث في الحصة</strong><small>{boardActions.length} خطوة على السبورة/الشرح</small></div>}
          </article>

          {shareKind === 'game' && (challengePlayers.length > 0 || players.length > 0) && (
            <article className="panel shared-game-card">
              <div className="panel-title"><div><span className="eyebrow">التحدي المباشر</span><h3>{payload.roomTitle || 'تحدي داخل الحصة'}</h3></div><Gamepad2 size={18} /></div>
              <div className="shared-player-list">{(challengePlayers.length ? challengePlayers : players).map((player) => <span key={player.id || player.name}>{player.name || player.label}</span>)}</div>
              <div className="shared-placeholder">افتح الرابط لعرض المورد والأسئلة المرتبطة بالتحدي.</div>
            </article>
          )}

          <article className="panel shared-questions-card">
            <div className="panel-title"><div><span className="eyebrow">الأسئلة المرتبطة</span><h3>محتوى النشاط</h3></div><Target size={18} /></div>
            <div className="shared-question-list">
              {questions.length ? questions.slice(0, 12).map((question) => (
                <div className="shared-question-item" key={question.id}><strong>#{question.id}</strong><span>{question.lesson || question.unit || question.topic || 'سؤال'}</span><small>{question.text || ''}</small></div>
              )) : <div className="shared-placeholder">لا توجد أسئلة مرتبطة في هذا الرابط.</div>}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
