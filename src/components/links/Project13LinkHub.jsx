// PROJECT13_SOCIAL_LESSON_LINKS_V1
import { ExternalLink, Facebook, Link2, Music2, Youtube } from 'lucide-react';
import { PROJECT_SOCIAL_DEFAULTS } from '../../config/projectSocialDefaults.js';

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export default function Project13LinkHub({ settings = {}, lesson = null, compact = false, title = 'روابط المُبدع' }) {
  const social = { ...PROJECT_SOCIAL_DEFAULTS, ...(settings.socialLinks || {}) };
  const links = [
    { key: 'youtube', label: 'YouTube', url: safeUrl(social.youtube), Icon: Youtube },
    { key: 'facebook', label: 'Facebook', url: safeUrl(social.facebook), Icon: Facebook },
    { key: 'tiktok', label: 'TikTok', url: safeUrl(social.tiktok), Icon: Music2 },
    { key: 'lesson', label: 'رابط الدرس', url: safeUrl(lesson?.lessonLink || lesson?.externalLink), Icon: Link2 },
  ].filter((item) => item.url);

  return (
    <article className={`panel project13-link-hub ${compact ? 'compact' : ''}`}>
      <div className="panel-heading compact">
        <div><span className="eyebrow">روابط ثابتة</span><h3>{title}</h3></div>
        <Link2 size={18}/>
      </div>
      {links.length ? (
        <div className="project13-link-grid">
          {links.map(({ key, label, url, Icon }) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer">
              <Icon size={17}/><span>{label}</span><ExternalLink size={13}/>
            </a>
          ))}
        </div>
      ) : <small className="settings-help">أضف روابط YouTube وFacebook وTikTok من الإعدادات، ويمكن إضافة رابط مستقل لكل درس.</small>}
    </article>
  );
}
