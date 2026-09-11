// PROJECT13_SOCIAL_LESSON_LINKS_V1
import { useEffect, useState } from 'react';
import { Facebook, Link2, Music2, Save, Youtube } from 'lucide-react';
import { PROJECT_SOCIAL_DEFAULTS } from '../../config/projectSocialDefaults.js';

function cleanUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error('الروابط يجب أن تبدأ بـ http(s)://');
  }
}

export default function Project13SocialLinkSettings({ data, updateData, onNotice }) {
  const current = data.settings?.socialLinks || {};
  const [form, setForm] = useState({
    youtube: current.youtube || PROJECT_SOCIAL_DEFAULTS.youtube,
    facebook: current.facebook || PROJECT_SOCIAL_DEFAULTS.facebook,
    tiktok: current.tiktok || PROJECT_SOCIAL_DEFAULTS.tiktok,
  });

  useEffect(() => {
    setForm({
      youtube: current.youtube || PROJECT_SOCIAL_DEFAULTS.youtube,
      facebook: current.facebook || PROJECT_SOCIAL_DEFAULTS.facebook,
      tiktok: current.tiktok || PROJECT_SOCIAL_DEFAULTS.tiktok,
    });
  }, [current.youtube, current.facebook, current.tiktok]);

  const save = async () => {
    try {
      const socialLinks = {
        youtube: cleanUrl(form.youtube),
        facebook: cleanUrl(form.facebook),
        tiktok: cleanUrl(form.tiktok),
      };
      await updateData((latest) => ({ ...latest, settings: { ...latest.settings, socialLinks } }));
      onNotice?.('تم حفظ روابط صفحاتك الثابتة، وستظهر في مركز الروابط داخل المنصة.');
    } catch (error) {
      onNotice?.(error?.message || 'تعذر حفظ الروابط.');
    }
  };

  return (
    <article className="panel project13-social-settings">
      <div className="panel-title"><div><span className="eyebrow">بدل قائمة التسجيلات</span><h3>روابط صفحات المُبدع</h3></div><Link2 size={20}/></div>
      <label><span><Youtube size={16}/> YouTube</span><input value={form.youtube} placeholder="https://youtube.com/..." onChange={(e) => setForm({ ...form, youtube: e.target.value })}/></label>
      <label><span><Facebook size={16}/> Facebook</span><input value={form.facebook} placeholder="https://facebook.com/..." onChange={(e) => setForm({ ...form, facebook: e.target.value })}/></label>
      <label><span><Music2 size={16}/> TikTok</span><input value={form.tiktok} placeholder="https://tiktok.com/@..." onChange={(e) => setForm({ ...form, tiktok: e.target.value })}/></label>
      <button className="primary-btn" type="button" onClick={() => void save()}><Save size={16}/> حفظ الروابط</button>
    </article>
  );
}
