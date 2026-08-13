import { useEffect, useState } from 'react';
import { getAssetBlob, importAssetBlob } from '../services/assetStore';
import { fetchStudentAsset } from '../services/studentPortalCloud';
import { normalizeSecureUrl } from '../utils/safety';

function emptyState(fallbackUrl = '') {
  return {
    url: normalizeSecureUrl(fallbackUrl, { allowRelative: true, allowData: true }),
    blob: null,
    loading: false,
    error: '',
    fromAssetStore: false,
    fromStudentCloud: false,
  };
}

export function useAssetSource(assetId, fallbackUrl = '', studentSession = null) {
  const [state, setState] = useState(() => emptyState(fallbackUrl));
  const studentEndpoint = studentSession?.endpoint || '';
  const studentWorkspace = studentSession?.workspaceId || '';
  const studentToken = studentSession?.studentToken || '';

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const fallback = normalizeSecureUrl(fallbackUrl, { allowRelative: true, allowData: true });

    const publishBlob = (blob, source = 'local') => {
      if (cancelled) return false;
      if (!(blob instanceof Blob) || blob.size <= 0) return false;
      objectUrl = URL.createObjectURL(blob);
      setState({
        url: objectUrl,
        blob,
        loading: false,
        error: '',
        fromAssetStore: source === 'local',
        fromStudentCloud: source === 'student-cloud',
      });
      return true;
    };

    if (!assetId) {
      setState({ ...emptyState(fallback), url: fallback });
      return () => {};
    }

    setState({ url: '', blob: null, loading: true, error: '', fromAssetStore: true, fromStudentCloud: false });
    (async () => {
      try {
        const localBlob = await getAssetBlob(assetId);
        if (publishBlob(localBlob, 'local')) return;
        if (studentEndpoint && studentWorkspace && studentToken) {
          const downloaded = await fetchStudentAsset({
            endpoint: studentEndpoint,
            workspaceId: studentWorkspace,
            studentToken,
          }, assetId);
          const remoteBlob = downloaded.blob;
          if (remoteBlob instanceof Blob && remoteBlob.size > 0) {
            await importAssetBlob(remoteBlob, {
              ...downloaded.metadata,
              id: String(assetId),
            }).catch(() => null);
            if (publishBlob(remoteBlob, 'student-cloud')) return;
          }
        }
        if (!cancelled) {
          setState({
            url: '',
            blob: null,
            loading: false,
            error: 'تعذر قراءة الملف الحقيقي من ذاكرة المنصة أو حساب الطالب السحابي.',
            fromAssetStore: true,
            fromStudentCloud: false,
          });
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          url: '',
          blob: null,
          loading: false,
          error: error?.message || 'تعذر فتح الملف المحفوظ.',
          fromAssetStore: true,
          fromStudentCloud: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, fallbackUrl, studentEndpoint, studentToken, studentWorkspace]);

  return state;
}
