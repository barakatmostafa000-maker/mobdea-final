// PROJECT14_YOUTUBE_AUTO_SYNC_V1
import { useMemo, useState } from 'react';
import { Plus, Save, Trash2, Youtube } from 'lucide-react';
import { extractYouTubePlaylistId } from '../../services/project14YoutubeSync.js';
import { PROJECT_SOCIAL_DEFAULTS } from '../../config/projectSocialDefaults.js';
const uniq = (items) => [...new Set(items.map((x) => String(x || '').trim()).filter(Boolean))];

export default function Project14YouTubeSyncSettings({ data, updateData, onNotice }) {
  const current = data.settings?.youtubeAutoSync || {};
  const grades = useMemo(() => uniq([
    ...(data.students || []).map((x) => x.grade),
    ...(data.contentLibrary || []).map((x) => x.grade),
    ...Object.keys(current.gradePlaylists || {}),
  ]), [data.students, data.contentLibrary, current.gradePlaylists]);

  const [enabled, setEnabled] = useState(current.enabled !== false);
  const [fallbackByTitle, setFallbackByTitle] = useState(current.fallbackByTitle !== false);
  const [channelUrl, setChannelUrl] = useState(current.channelUrl || data.settings?.socialLinks?.youtube || PROJECT_SOCIAL_DEFAULTS.youtube);
  const [gradePlaylists, setGradePlaylists] = useState(current.gradePlaylists || {});
  const [extraGrade, setExtraGrade] = useState('');

  const save = async () => {
    for (const [grade, url] of Object.entries(gradePlaylists)) {
      if (String(url || '').trim() && !extractYouTubePlaylistId(url)) {
        onNotice?.(`رابط Playlist غير صحيح للصف: ${grade}`);
        return;
      }
    }
    await updateData((latest) => ({
      ...latest,
      settings: {
        ...latest.settings,
        youtubeAutoSync: {
          enabled,
          fallbackByTitle,
          channelUrl: String(channelUrl || '').trim() || latest.settings?.socialLinks?.youtube || PROJECT_SOCIAL_DEFAULTS.youtube,
          gradePlaylists,
          refreshMinutes: 3,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    onNotice?.('تم حفظ مزامنة YouTube حسب الصف.');
  };

  const visibleGrades = uniq([...grades, ...Object.keys(gradePlaylists)]);

  return (
    <article className="panel project14-youtube-settings">
      <div className="panel-title"><div><span className="eyebrow">YouTube Auto Sync</span><h3>فيديوهات تلقائية حسب الصف</h3></div><Youtube size={22}/></div>
      <label className="project14-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/><span><strong>تشغيل المزامنة</strong><small>الفيديو يظهر للطلاب بدون رفعه مرة ثانية للمنصة.</small></span></label>
      <label><span>رابط القناة</span><input value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://youtube.com/@..."/></label>
      <label className="project14-check"><input type="checkbox" checked={fallbackByTitle} onChange={(e) => setFallbackByTitle(e.target.checked)}/><span><strong>Fallback من عنوان/وصف الفيديو</strong><small>يعمل لو الصف مفيش له Playlist.</small></span></label>

      <div className="project14-playlists">
        {visibleGrades.map((grade) => (
          <div className="project14-playlist-row" key={grade}>
            <span>{grade}</span>
            <input value={gradePlaylists[grade] || ''} onChange={(e) => setGradePlaylists((v) => ({ ...v, [grade]: e.target.value }))} placeholder="رابط Playlist للصف"/>
            <button className="icon-action danger-text" type="button" onClick={() => setGradePlaylists((v) => { const n={...v}; delete n[grade]; return n; })}><Trash2 size={15}/></button>
          </div>
        ))}
      </div>

      <div className="project14-add-grade">
        <input value={extraGrade} onChange={(e) => setExtraGrade(e.target.value)} placeholder="إضافة صف"/>
        <button className="secondary-btn" type="button" onClick={() => {
          const grade = extraGrade.trim();
          if (!grade) return;
          setGradePlaylists((v) => ({ ...v, [grade]: v[grade] || '' }));
          setExtraGrade('');
        }}><Plus size={15}/> إضافة</button>
      </div>

      <button className="primary-btn" type="button" onClick={() => void save()}><Save size={16}/> حفظ</button>
    </article>
  );
}
