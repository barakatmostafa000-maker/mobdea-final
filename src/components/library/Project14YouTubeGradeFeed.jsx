// PROJECT14_YOUTUBE_AUTO_SYNC_V1
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Youtube } from 'lucide-react';
import { fetchYouTubeGradeVideos, youtubeGradeSyncConfig } from '../../services/project14YoutubeSync';

export default function Project14YouTubeGradeFeed({ settings = {}, grade = '' }) {
  const config = youtubeGradeSyncConfig(settings);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');

  const load = useCallback(async () => {
    if (!config.enabled || !grade) return;
    setLoading(true);
    try {
      const result = await fetchYouTubeGradeVideos(settings, grade);
      setVideos(result.videos || []);
      setSource(result.source || '');
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [config.enabled, grade, settings]);

  useEffect(() => {
    if (!config.enabled || !grade) return undefined;
    void load();
    const timer = setInterval(load, 3 * 60 * 1000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    globalThis.addEventListener?.('online', load);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
      globalThis.removeEventListener?.('online', load);
    };
  }, [config.enabled, grade, load]);

  if (!config.enabled || !grade || (!videos.length && !loading)) return null;

  return (
    <article className="panel project14-youtube-feed">
      <div className="panel-heading compact">
        <div><span className="eyebrow"><Youtube size={14}/> YouTube تلقائي</span><h3>فيديوهات {grade}</h3><small>{source === 'playlist' ? 'Playlist الصف' : 'مصنفة تلقائيًا من القناة'}</small></div>
        <button className="icon-action" type="button" onClick={() => void load()}><RefreshCw size={15}/></button>
      </div>
      {loading && !videos.length ? <div className="project14-loading">جارٍ جلب الفيديوهات…</div> : (
        <div className="project14-video-grid">
          {videos.map((video) => (
            <a className="project14-video-card" href={video.url} target="_blank" rel="noopener noreferrer" key={video.id}>
              <img src={video.thumbnail} alt="" loading="lazy"/>
              <span><strong>{video.title}</strong><small>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('ar-EG') : ''}</small></span>
              <ExternalLink size={14}/>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
