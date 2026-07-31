import { Download, ExternalLink, Link as LinkIcon, PlayCircle } from 'lucide-react';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { copyToClipboard } from '../../services/share';
import { formatDateAr } from '../../utils/time';

function durationLabel(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = Math.floor(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function LessonRecordingItem({ recording, onNotice }) {
  const videoUrl = useAssetUrl(recording.videoAssetId, recording.videoUrl);
  const download = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = recording.videoFileName || `تسجيل-${recording.id}.webm`;
    link.click();
  };

  return (
    <div className="classmode-recording-item">
      <strong>{recording.sessionTitle || recording.title || 'حصة محفوظة'}</strong>
      <small>
        {formatDateAr(recording.createdAt)} • {recording.grade || 'الصف'}
        {recording.durationSeconds ? ` • ${durationLabel(recording.durationSeconds)}` : ''}
      </small>
      {videoUrl && (
        <video className="classmode-recording-preview" src={videoUrl} controls preload="metadata" />
      )}
      <div className="classmode-recording-actions">
        {videoUrl && <button className="secondary-btn" type="button" onClick={download}><Download size={14} /> تنزيل</button>}
        {recording.shareUrl && <button className="secondary-btn" type="button" onClick={async () => {
          const copied = await copyToClipboard(recording.shareUrl);
          onNotice?.(copied ? 'تم نسخ رابط التسجيل.' : 'تعذر نسخ الرابط.');
        }}><LinkIcon size={14} /> نسخ الرابط</button>}
        {recording.shareUrl && <button className="secondary-btn" type="button" onClick={() => globalThis.open?.(recording.shareUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} /> فتح</button>}
        {!videoUrl && !recording.shareUrl && <span className="recording-log-only"><PlayCircle size={14} /> سجل الحصة محفوظ بدون فيديو</span>}
      </div>
    </div>
  );
}
