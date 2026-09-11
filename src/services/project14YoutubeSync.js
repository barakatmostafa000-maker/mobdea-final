// PROJECT14_YOUTUBE_AUTO_SYNC_V1
import { buildCloudUrl, timeoutFetch } from './cloudTransport.js';
import { PROJECT_SOCIAL_DEFAULTS } from '../config/projectSocialDefaults.js';

export function extractYouTubePlaylistId(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_-]{12,80}$/.test(text) && !/^https?:/i.test(text)) return text;
  try {
    const url = new URL(text);
    const list = url.searchParams.get('list');
    return list && /^[A-Za-z0-9_-]{12,80}$/.test(list) ? list : '';
  } catch {
    return '';
  }
}

export function youtubeGradeSyncConfig(settings = {}) {
  const cloud = settings.cloudSync || {};
  const sync = settings.youtubeAutoSync || {};
  return {
    endpoint: String(cloud.endpoint || '').replace(/\/$/, ''),
    workspaceId: String(cloud.workspaceId || '').replace(/[^a-zA-Z0-9_-]/g, ''),
    enabled: sync.enabled !== false,
    channelUrl: String(sync.channelUrl || settings.socialLinks?.youtube || PROJECT_SOCIAL_DEFAULTS.youtube).trim(),
    fallbackByTitle: sync.fallbackByTitle !== false,
    gradePlaylists: sync.gradePlaylists && typeof sync.gradePlaylists === 'object' ? sync.gradePlaylists : {},
  };
}

export async function fetchYouTubeGradeVideos(settings = {}, grade = '') {
  const config = youtubeGradeSyncConfig(settings);
  const cleanGrade = String(grade || '').trim();
  if (!config.enabled || !cleanGrade || !/^https:\/\//i.test(config.endpoint) || !config.workspaceId) return { videos: [], source: 'disabled', grade: cleanGrade };

  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, `/youtube/grade-feed?grade=${encodeURIComponent(cleanGrade)}`),
    { headers: { Accept: 'application/json', 'X-Mobdea-Workspace': config.workspaceId, 'X-Mobdea-Client': 'mobdea-youtube-grade/14' } },
    22000,
  );
  if (!response.ok) throw new Error(`تعذر تحديث فيديوهات YouTube (${response.status}).`);
  const payload = await response.json();
  return { ...payload, videos: Array.isArray(payload.videos) ? payload.videos : [] };
}
