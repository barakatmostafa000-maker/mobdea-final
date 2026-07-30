import { Rocket, X } from 'lucide-react';

export default function UpdatePrompt({ currentVersion, newVersion, notes, mandatory, onUpdateNow, onLater, busy }) {
  return (
    <div className="update-prompt-overlay" role="dialog" aria-modal="true">
      <div className="update-prompt-card">
        {!mandatory && (
          <button type="button" className="update-prompt-close" onClick={onLater} aria-label="لاحقًا"><X size={18} /></button>
        )}
        <div className="update-prompt-icon"><Rocket size={28} /></div>
        <h2>يتوفر إصدار جديد من منصة المُبدع مصطفى بركات</h2>
        <div className="update-prompt-versions">
          <span>الإصدار الحالي: <b>{currentVersion}</b></span>
          <span>الإصدار الجديد: <b>{newVersion}</b></span>
        </div>
        {notes && <p className="update-prompt-notes">{notes}</p>}
        {mandatory && <p className="update-prompt-mandatory">هذا التحديث إجباري ولا يمكن استخدام المنصة قبل تثبيته.</p>}
        <div className="update-prompt-actions">
          <button type="button" className="primary-btn" onClick={onUpdateNow} disabled={busy}>{busy ? 'جارٍ التحديث...' : 'تحديث الآن'}</button>
          {!mandatory && <button type="button" className="secondary-btn" onClick={onLater}>لاحقًا</button>}
        </div>
      </div>
    </div>
  );
}
