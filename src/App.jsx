import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from './components/AppShell';
import AppErrorBoundary from './components/AppErrorBoundary';
import LockScreen from './components/LockScreen';
import Placeholder from './pages/Placeholder';
import SharedAccess from './pages/SharedAccess';
import { loadAppData, saveAppData, resetAppData } from './services/storage';
import { checkForUpdate, openApkDownload } from './services/updater';
import { registerServiceWorker, applyServiceWorkerUpdate } from './services/pwaUpdate';
import { cloudConfigured, pullCloudData, pullCloudDataIfExists, pushCloudData } from './services/cloudSync';
import { mergeAppData, normalizeStudentCodes } from './services/dataMerge';
import { shouldRunAutoBackup } from './services/autoBackup';
import UpdatePrompt from './components/UpdatePrompt';
import { speakWelcome } from './services/voice';
import { readShareFromLocation, resolveShareFromLocation } from './services/share';
import { release } from './config/release';
import { ROLE_HOME, getRoleModules, buildWelcomeMessage } from './utils/auth';
import { identity } from './config/identity';
import { mergeStudentPortalSnapshot, refreshStudentPortalSnapshot } from './services/studentPortalCloud';

const MapChallenge = lazy(() => import('./pages/MapChallenge'));
const ContentLibrary = lazy(() => import('./pages/ContentLibrary'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Grades = lazy(() => import('./pages/Grades'));
const GradeScanner = lazy(() => import('./pages/GradeScanner'));
const ResultDetails = lazy(() => import('./pages/ResultDetails'));
const Payments = lazy(() => import('./pages/Payments'));
const Messages = lazy(() => import('./pages/Messages'));
const Reports = lazy(() => import('./pages/Reports'));
const Games = lazy(() => import('./pages/Games'));
const Achievements = lazy(() => import('./pages/Achievements'));
const QuestionBankManager = lazy(() => import('./pages/QuestionBankManager'));

const ClassMode = lazy(() => import('./pages/ClassMode'));
const Whiteboard = lazy(() => import('./pages/Whiteboard'));
const StudentCards = lazy(() => import('./pages/StudentCards'));
const Settings = lazy(() => import('./pages/Settings'));
const PortalPreview = lazy(() => import('./pages/PortalPreview'));
const DeviceDiagnostics = lazy(() => import('./pages/DeviceDiagnostics'));
const SmartAssistant = lazy(() => import('./pages/SmartAssistant'));

const Updates = lazy(() => import('./pages/Updates'));

const LoadingScreen = () => <div className="loading-screen"><div className="loading-mark">م</div><h1>منصة المُبدع</h1><p>جارٍ تحميل الصفحة...</p></div>;

const DATA_LOAD_TIMEOUT_MS = 15000;

function loadAppDataWithTimeout() {
  return Promise.race([
    loadAppData(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('استغرق فتح البيانات وقتًا أطول من المتوقع. أعد المحاولة دون إغلاق التطبيق.')), DATA_LOAD_TIMEOUT_MS);
    }),
  ]);
}

const AUTH_STORAGE_KEY = 'mobdea_mobile_auth_v2';
const AUTH_TTL_REMEMBERED = 7 * 24 * 60 * 60 * 1000;
const AUTH_TTL_SESSION = 12 * 60 * 60 * 1000;
const VALID_ROLES = new Set(['admin', 'teacher', 'student', 'guardian', 'visitor']);

function validateStoredAuth(raw, storage) {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !VALID_ROLES.has(parsed.role) || !Number.isFinite(Number(parsed.expiresAt)) || Number(parsed.expiresAt) <= Date.now()) {
      storage?.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage?.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function readAuthFromStorage() {
  try {
    // "تذكرني" sessions are kept in localStorage so they survive app restarts;
    // regular sessions live only in sessionStorage for the current tab.
    const persisted = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    const remembered = validateStoredAuth(persisted, globalThis.localStorage);
    if (remembered) return remembered;
    return validateStoredAuth(globalThis.sessionStorage?.getItem(AUTH_STORAGE_KEY), globalThis.sessionStorage);
  } catch {
    return null;
  }
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  // === MOBDEA ANDROID BACK START ===
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listenerHandle;
    let disposed = false;

    const isVisible = (element) => {
      if (!element) return false;

      const style = window.getComputedStyle(element);

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0
      );
    };

    const closeVisibleOverlay = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return true;
      }

      const overlaySelectors = [
        '[role="dialog"]',
        '.modal-backdrop',
        '.modal-card',
        '.drawer.open',
        '.drawer.is-open',
        '.mobile-menu.open',
        '.mobile-menu.is-open',
      ].join(',');

      const overlay = Array.from(
        document.querySelectorAll(overlaySelectors),
      ).find(isVisible);

      if (!overlay) return false;

      const closeButton =
        overlay.querySelector(
          '[data-close], .modal-close, .drawer-close, ' +
            '.close-button, button[aria-label="إغلاق"], ' +
            'button[aria-label="Close"]',
        ) ||
        Array.from(
          document.querySelectorAll(
            '[data-close], .modal-close, .drawer-close, ' +
              '.close-button, button[aria-label="إغلاق"], ' +
              'button[aria-label="Close"]',
          ),
        ).find(isVisible);

      if (closeButton) {
        closeButton.click();
      } else {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
          }),
        );
      }

      return true;
    };

    void CapacitorApp.addListener('backButton', () => {
      if (closeVisibleOverlay()) return;

      if (String(active) !== 'dashboard') {
        setActive('dashboard');
        return;
      }

      void CapacitorApp.exitApp();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }

      listenerHandle = handle;
    });

    return () => {
      disposed = true;

      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [active, setActive]);
  // === MOBDEA ANDROID BACK END ===

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [auth, setAuth] = useState(() => readAuthFromStorage());
  useEffect(() => {
    if (!auth) return;
    if (active === 'dashboard' && ['student', 'guardian'].includes(auth.role)) {
      setActive('portalPreview');
    }
  }, [active, auth?.role]);

  const rememberRef = useRef(Boolean(globalThis.localStorage?.getItem(AUTH_STORAGE_KEY)));
  const [welcomePlayed, setWelcomePlayed] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const swReadyRef = useRef(false);
  const dataRef = useRef(null);
  const persistedDataRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const autoBackupRunningRef = useRef(false);
  const autoSyncRunningRef = useRef(false);

  useEffect(() => registerServiceWorker(() => { swReadyRef.current = true; }), []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!welcomeToast) return undefined;
    const timer = setTimeout(() => setWelcomeToast(''), 5000);
    return () => clearTimeout(timer);
  }, [welcomeToast]);
  const [shareState, setShareState] = useState(() => readShareFromLocation(globalThis.location));
  const autoCheckedRef = useRef(false);

  const reloadData = useCallback(async () => {
    setLoadError('');
    try {
      let loaded;
      try {
        loaded = await loadAppDataWithTimeout();
      } catch (firstError) {
        // A transient IndexedDB/Preferences lock is common after Android WebView
        // restoration. One delayed retry fixes it without deleting user data.
        await new Promise((resolve) => setTimeout(resolve, 450));
        loaded = await loadAppDataWithTimeout().catch(() => {
          throw firstError;
        });
      }
      dataRef.current = loaded;
      persistedDataRef.current = loaded;
      setData(loaded);
    } catch (error) {
      setLoadError(error?.message || 'تعذر فتح بيانات التطبيق المشفرة.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await reloadData();
    };
    void run();
    return () => { cancelled = true; };
  }, [reloadData]);

  useEffect(() => {
    try {
      if (auth && rememberRef.current) {
        globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        globalThis.sessionStorage?.removeItem(AUTH_STORAGE_KEY);
      } else if (auth) {
        globalThis.sessionStorage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
      } else {
        globalThis.sessionStorage?.removeItem(AUTH_STORAGE_KEY);
        globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return undefined;
    const expiresIn = Number(auth.expiresAt) - Date.now();
    if (expiresIn <= 0) {
      handleLogout();
      return undefined;
    }
    const timer = setTimeout(handleLogout, Math.min(expiresIn, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [auth?.expiresAt]);

  useEffect(() => {
    if (!data || !auth || !['student', 'guardian'].includes(auth.role)) return;
    const students = Array.isArray(data.students) ? data.students : [];
    const normalize = (value) => String(value || '').replace(/\D/g, '').slice(-10);
    const linked = students.some((student) => {
      if (String(student.id) === String(auth.studentId)) return true;
      if (auth.role === 'student' && String(student.code) === String(auth.studentCode || '')) return true;
      if (auth.role === 'guardian' && normalize(student.guardianPhone) === normalize(auth.guardianPhone)) return true;
      return false;
    });
    if (!linked) handleLogout();
  }, [data?.students, auth?.guardianPhone, auth?.role, auth?.studentCode, auth?.studentId]);

  useEffect(() => {
    let cancelled = false;
    const initial = readShareFromLocation(globalThis.location);
    setShareState(initial);
    if (initial.mode === 'remote') {
      resolveShareFromLocation(globalThis.location).then((resolved) => { if (!cancelled) setShareState(resolved); });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data || !auth || !data.settings.lockEnabled) return undefined;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setAuth(null), Math.max(1, Number(data.settings.lockAfterMinutes || 10)) * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => { clearTimeout(timer); events.forEach((event) => window.removeEventListener(event, resetTimer)); };
  }, [data?.settings?.lockEnabled, data?.settings?.lockAfterMinutes, auth]);

  const updateData = useCallback((nextOrUpdater, options = {}) => {
    let candidate = typeof nextOrUpdater === 'function' ? nextOrUpdater(dataRef.current) : nextOrUpdater;
    if (!candidate || typeof candidate !== 'object') return Promise.reject(new Error('بيانات الحفظ غير صالحة.'));

    if (!options.skipCloudDirty && candidate.settings?.cloudSync) {
      candidate = {
        ...candidate,
        settings: {
          ...candidate.settings,
          cloudSync: {
            ...candidate.settings.cloudSync,
            localChangedAt: new Date().toISOString(),
            autoSyncError: '',
          },
        },
      };
    }

    dataRef.current = candidate;
    setData(candidate);

    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveAppData(candidate));
    saveQueueRef.current = operation.catch(() => undefined);

    return operation.then((saved) => {
      persistedDataRef.current = saved;
      if (dataRef.current === candidate) {
        dataRef.current = saved;
        setData(saved);
      }
      return saved;
    }).catch((error) => {
      if (dataRef.current === candidate) {
        dataRef.current = persistedDataRef.current;
        setData(persistedDataRef.current);
      }
      throw error;
    });
  }, []);

  useEffect(() => {
    if (!data || !auth || welcomePlayed || !data.settings.welcomeVoice) return;
    const timer = setTimeout(() => {
      speakWelcome(data.settings);
      setWelcomePlayed(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, auth, welcomePlayed]);

  useEffect(() => {
    if (!data?.settings?.update?.autoCheck) return undefined;
    let cancelled = false;
    let running = false;

    const run = async () => {
      const current = dataRef.current;
      if (!current?.settings?.update?.autoCheck || running) return;
      running = true;
      try {
        const result = await checkForUpdate(current.settings, release.appVersion);
        if (cancelled) return;
        const checkedAt = new Date().toISOString();
        const latest = dataRef.current || current;
        const history = [{ checkedAt, version: result.version, available: result.available }, ...(latest.updateHistory || [])].slice(0, 20);
        const next = {
          ...latest,
          updateHistory: history,
          settings: {
            ...latest.settings,
            update: {
              ...(latest.settings.update || {}),
              manifestUrl: latest.settings.update?.manifestUrl || release.manifestPath,
              autoCheck: true,
              lastAutoCheckAt: checkedAt,
              lastAutoCheckVersion: result.version,
              lastAutoCheckAvailable: result.available,
            },
          },
        };
        const saved = await updateData(next);
        if (cancelled) return;
        const dismissed = saved.settings.update?.dismissedVersion;
        if (result.available && (result.mandatory || dismissed !== result.version)) setUpdateInfo(result);
      } catch {
        // Update checks must never interrupt normal app use.
      } finally {
        running = false;
      }
    };

    if (!autoCheckedRef.current) {
      autoCheckedRef.current = true;
      void run();
    }
    const interval = setInterval(run, 60 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data?.settings?.update?.autoCheck, data?.settings?.update?.manifestUrl, updateData]);


  useEffect(() => {
    if (auth?.role !== 'student') return undefined;
    let cancelled = false;
    let running = false;

    const refreshStudentData = async () => {
      const current = dataRef.current;
      const session = current?.settings?.studentPortalSession;
      if (!current || !session?.studentToken || running) return;
      if (globalThis.navigator && globalThis.navigator.onLine === false) return;
      running = true;
      try {
        const payload = await refreshStudentPortalSnapshot(session);
        if (cancelled) return;
        const merged = mergeStudentPortalSnapshot(current, payload, session);
        await updateData(merged, { skipCloudDirty: true });
      } catch (error) {
        if (cancelled) return;
        await updateData((latest) => ({
          ...latest,
          settings: {
            ...latest.settings,
            studentPortalSession: {
              ...(latest.settings?.studentPortalSession || {}),
              lastError: String(error?.message || 'تعذر تحديث حساب الطالب.').slice(0, 220),
            },
          },
        }), { skipCloudDirty: true }).catch(() => null);
      } finally {
        running = false;
      }
    };

    const first = setTimeout(refreshStudentData, 700);
    const interval = setInterval(refreshStudentData, 2 * 60 * 1000);
    const onVisible = () => { if (!document.hidden) void refreshStudentData(); };
    document.addEventListener('visibilitychange', onVisible);
    globalThis.addEventListener?.('online', refreshStudentData);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      globalThis.removeEventListener?.('online', refreshStudentData);
    };
  }, [auth?.role, data?.settings?.studentPortalSession?.studentToken, updateData]);


  useEffect(() => {
    if (!['admin', 'teacher'].includes(auth?.role)) return undefined;

    let cancelled = false;

    const runAutoBackup = async () => {
      const current = dataRef.current;
      if (!current || autoBackupRunningRef.current) return;
      if (globalThis.navigator && globalThis.navigator.onLine === false) return;
      if (!shouldRunAutoBackup(current.settings, Date.now())) return;

      autoBackupRunningRef.current = true;
      try {
        const result = await pushCloudData(current);
        if (cancelled) return;

        const completedAt = result.updatedAt || new Date().toISOString();
        await updateData((latest) => ({
          ...latest,
          settings: {
            ...latest.settings,
            cloudSync: {
              ...latest.settings.cloudSync,
              revision: result.revision,
              lastPushAt: completedAt,
              lastAutoBackupAt: completedAt,
              localChangedAt: '',
              autoBackupError: '',
            },
          },
        }), { skipCloudDirty: true });
      } catch (error) {
        if (cancelled) return;

        await updateData((latest) => ({
          ...latest,
          settings: {
            ...latest.settings,
            cloudSync: {
              ...latest.settings.cloudSync,
              autoBackupError: String(
                error?.message || 'تعذر إنشاء النسخة السحابية التلقائية.',
              ).slice(0, 240),
            },
          },
        }), { skipCloudDirty: true }).catch(() => null);
      } finally {
        autoBackupRunningRef.current = false;
      }
    };

    void runAutoBackup();
    const interval = setInterval(runAutoBackup, 15 * 60 * 1000);
    globalThis.addEventListener?.('online', runAutoBackup);

    return () => {
      cancelled = true;
      clearInterval(interval);
      globalThis.removeEventListener?.('online', runAutoBackup);
    };
  }, [
    auth?.role,
    data?.settings?.cloudSync?.autoBackup,
    data?.settings?.cloudSync?.autoBackupIntervalHours,
    data?.settings?.cloudSync?.endpoint,
    data?.settings?.cloudSync?.lastAutoBackupAt,
    data?.settings?.cloudSync?.lastPushAt,
    data?.settings?.cloudSync?.token,
    data?.settings?.cloudSync?.workspaceId,
    updateData,
  ]);


  useEffect(() => {
    if (!['admin', 'teacher'].includes(auth?.role)) return undefined;

    let cancelled = false;
    let initialTimer;

    const recordSyncError = async (message) => {
      if (cancelled) return;
      await updateData((latest) => ({
        ...latest,
        settings: {
          ...latest.settings,
          cloudSync: {
            ...latest.settings.cloudSync,
            autoSyncError: String(message || 'تعذر إكمال المزامنة التلقائية.').slice(0, 240),
          },
        },
      }), { skipCloudDirty: true }).catch(() => null);
    };

    const localCloudConfig = (current, remoteCloud = {}) => ({
      ...remoteCloud,
      ...(current?.settings?.cloudSync || {}),
      token: current?.settings?.cloudSync?.token || '',
      endpoint: current?.settings?.cloudSync?.endpoint || remoteCloud.endpoint || '',
      workspaceId: current?.settings?.cloudSync?.workspaceId || remoteCloud.workspaceId || '',
    });

    const pushMergedSnapshot = async (localSnapshot, initialRemote) => {
      let remote = initialRemote;
      let source = localSnapshot;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const merged = mergeAppData(source, remote.data);
        const pulledAt = new Date().toISOString();
        merged.students = normalizeStudentCodes(merged.students || []);
        merged.settings = {
          ...merged.settings,
          cloudSync: {
            ...localCloudConfig(source, remote.data?.settings?.cloudSync),
            revision: remote.revision,
            lastPullAt: pulledAt,
          },
        };
        try {
          const result = await pushCloudData(merged);
          return { merged, result, completedAt: pulledAt };
        } catch (error) {
          const conflict = String(error?.message || '').includes('نسخة سحابية أحدث');
          if (!conflict || attempt > 0) throw error;
          // Another device pushed after our pull. Download once more, merge the
          // newest records, repair codes, and retry without making the teacher
          // wait for the next scheduled interval.
          remote = await pullCloudData(source.settings);
          source = dataRef.current || merged;
        }
      }
      throw new Error('تعذر دمج النسخة السحابية بعد محاولتين.');
    };

    const runAutoSync = async () => {
      const current = dataRef.current;
      const cloud = current?.settings?.cloudSync;
      if (!current || !cloud || cloud.autoSync === false || autoSyncRunningRef.current) return;
      if (globalThis.navigator && globalThis.navigator.onLine === false) return;
      if (!cloudConfigured(current.settings)) return;

      autoSyncRunningRef.current = true;
      try {
        const remote = await pullCloudDataIfExists(current.settings);
        if (cancelled) return;

        if (!remote) {
          const seeded = {
            ...current,
            students: normalizeStudentCodes(current.students || []),
            settings: {
              ...current.settings,
              cloudSync: { ...current.settings.cloudSync, revision: '' },
            },
          };
          const result = await pushCloudData(seeded);
          if (cancelled) return;
          const completedAt = result.updatedAt || new Date().toISOString();
          await updateData((latest) => ({
            ...seeded,
            settings: {
              ...seeded.settings,
              cloudSync: {
                ...localCloudConfig(latest),
                revision: result.revision,
                lastPushAt: completedAt,
                lastAutoSyncAt: completedAt,
                localChangedAt: '',
                autoSyncError: '',
              },
            },
          }), { skipCloudDirty: true });
          return;
        }

        const completedAt = new Date().toISOString();
        if (cloud.localChangedAt) {
          const pushed = await pushMergedSnapshot(current, remote);
          if (cancelled) return;
          const pushedAt = pushed.result.updatedAt || pushed.completedAt;
          pushed.merged.settings.cloudSync = {
            ...pushed.merged.settings.cloudSync,
            revision: pushed.result.revision,
            lastPushAt: pushedAt,
            lastAutoSyncAt: pushedAt,
            localChangedAt: '',
            autoSyncError: '',
          };
          await updateData(pushed.merged, { skipCloudDirty: true });
          return;
        }

        if (remote.revision === cloud.revision) return;
        const restored = {
          ...remote.data,
          students: normalizeStudentCodes(remote.data?.students || []),
          settings: {
            ...remote.data.settings,
            cloudSync: {
              ...localCloudConfig(current, remote.data?.settings?.cloudSync),
              revision: remote.revision,
              lastPullAt: completedAt,
              lastAutoSyncAt: completedAt,
              localChangedAt: '',
              autoSyncError: '',
            },
          },
        };
        await updateData(restored, { skipCloudDirty: true });
      } catch (error) {
        await recordSyncError(error?.message || 'تعذر إكمال المزامنة التلقائية.');
      } finally {
        autoSyncRunningRef.current = false;
      }
    };

    const minutes = Math.max(1, Math.min(60, Number(data?.settings?.cloudSync?.autoSyncIntervalMinutes || 2)));
    const localDirty = Boolean(data?.settings?.cloudSync?.localChangedAt);
    initialTimer = setTimeout(runAutoSync, localDirty ? 900 : 2200);
    const interval = setInterval(runAutoSync, minutes * 60 * 1000);
    const onVisible = () => { if (!document.hidden) void runAutoSync(); };
    document.addEventListener('visibilitychange', onVisible);
    globalThis.addEventListener?.('online', runAutoSync);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      globalThis.removeEventListener?.('online', runAutoSync);
    };
  }, [
    auth?.role,
    data?.settings?.cloudSync?.autoSync,
    data?.settings?.cloudSync?.autoSyncIntervalMinutes,
    data?.settings?.cloudSync?.endpoint,
    data?.settings?.cloudSync?.localChangedAt,
    data?.settings?.cloudSync?.token,
    data?.settings?.cloudSync?.workspaceId,
    updateData,
  ]);

  const handleUnlock = (session, options = {}) => {
    const remember = Boolean(options.remember);
    const next = { ...(session || { role: 'admin' }), expiresAt: Date.now() + (remember ? AUTH_TTL_REMEMBERED : AUTH_TTL_SESSION) };
    rememberRef.current = remember;
    setAuth(next);
    setActive(ROLE_HOME[next.role] || 'dashboard');
    if (shareState.kind === 'game') setActive('games');
    if (shareState.kind === 'lesson' || shareState.kind === 'portal') setActive('classMode');
    setWelcomeToast(buildWelcomeMessage(next, identity));
  };

  const handleLogout = () => {
    rememberRef.current = false;
    setAuth(null);
    setWelcomePlayed(false);
    setWelcomeToast('');
    setActive('dashboard');
  };

  const handleUpdateNow = async () => {
    if (!updateInfo) return;
    setUpdateBusy(true);
    try {
      if (window.Capacitor?.isNativePlatform?.()) {
        await openApkDownload(updateInfo);
      } else if (swReadyRef.current) {
        applyServiceWorkerUpdate();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleUpdateLater = async () => {
    if (!updateInfo || updateInfo.mandatory) return;
    const next = { ...data, settings: { ...data.settings, update: { ...(data.settings.update || {}), dismissedVersion: updateInfo.version } } };
    await updateData(next);
    setUpdateInfo(null);
  };

  const allowedModules = useMemo(() => getRoleModules(auth?.role), [auth?.role]);

  const goHomeFromShare = () => {
    const url = new URL(globalThis.location?.href || '/');
    url.search = '';
    url.hash = '';
    globalThis.history?.replaceState({}, '', url.toString());
    setShareState({ kind: '', payload: null, token: null, mode: 'none' });
    if (auth) setActive('dashboard');
  };

  if (loadError) return <div className="loading-screen loading-recovery" role="alert"><img className="loading-logo" src={identity.logo} alt={identity.schoolName} /><h1>تعذر فتح المنصة</h1><p>{loadError}</p><div className="loading-recovery-actions"><button className="primary-btn" type="button" onClick={() => void reloadData()}>إعادة المحاولة بأمان</button><button className="secondary-btn" type="button" onClick={() => globalThis.location?.reload?.()}>إعادة تشغيل الواجهة</button></div><small>لن يتم حذف أي بيانات عند إعادة المحاولة.</small></div>;
  if (!data) return <LoadingScreen />;
  if (shareState.kind && (!auth || shareState.kind === 'live')) {
    return (
      <>
        {updateInfo && <UpdatePrompt currentVersion={release.displayVersion} newVersion={updateInfo.version} notes={updateInfo.notes} mandatory={updateInfo.mandatory} busy={updateBusy} onUpdateNow={handleUpdateNow} onLater={handleUpdateLater} />}
        <SharedAccess shareKind={shareState.kind} sharePayload={shareState.payload} shareLoading={shareState.loading} shareError={shareState.error} onGoHome={goHomeFromShare} />
      </>
    );
  }
  if (!auth) {
    return (
      <>
        {updateInfo && <UpdatePrompt currentVersion={release.displayVersion} newVersion={updateInfo.version} notes={updateInfo.notes} mandatory={updateInfo.mandatory} busy={updateBusy} onUpdateNow={handleUpdateNow} onLater={handleUpdateLater} />}
        <LockScreen data={data} onUnlock={handleUnlock} updateData={updateData} />
      </>
    );
  }

  const common = { data, updateData, auth, role: auth.role };
  const screenProps = {
    dashboard: { data, navigate: setActive, auth },
    classMode: { ...common, navigate: setActive, shareState },
    whiteboard: { ...common, navigate: setActive },
    students: common,
    studentCards: { data, auth },
    portalPreview: { data, auth, navigate: setActive },
    diagnostics: { data, auth },
    smartAssistant: { data, auth },
    contentLibrary: { ...common, navigate: setActive },
    updates: common,
    sessions: common,
    attendance: common,
    gradeScanner: common,
    resultDetails: common,
    grades: common,
    payments: common,
    questionBank: common,
    games: { ...common, shareState, navigate: setActive },
    achievements: common,
    mapChallenge: { ...common, navigate: setActive },
    messages: common,
    reports: { data, auth },
    settings: { ...common, resetAppData },
  };

  const screenMap = {
    dashboard: Dashboard,
    classMode: ClassMode,
    whiteboard: Whiteboard,
    students: Students,
    studentCards: StudentCards,
    portalPreview: PortalPreview,
    diagnostics: DeviceDiagnostics,
    smartAssistant: SmartAssistant,
    contentLibrary: ContentLibrary,
    updates: Updates,
    sessions: Sessions,
    attendance: Attendance,
    gradeScanner: GradeScanner,
    resultDetails: ResultDetails,
    grades: Grades,
    payments: Payments,
    questionBank: QuestionBankManager,
    games: Games,
    achievements: Achievements,
    mapChallenge: MapChallenge,
    messages: Messages,
    reports: Reports,
    settings: Settings,
  };

  const constrainedActive = allowedModules && !allowedModules.has(active)
    ? ROLE_HOME[auth?.role] || 'dashboard'
    : active;
  const Screen = screenMap[constrainedActive] || Placeholder;
  const ScreenProps = screenProps[constrainedActive] || { title: 'قيد التطوير', subtitle: 'سيتم استكمال الوحدة في الإصدار التالي.' };

  return (
    <>
      {updateInfo && <UpdatePrompt currentVersion={release.displayVersion} newVersion={updateInfo.version} notes={updateInfo.notes} mandatory={updateInfo.mandatory} busy={updateBusy} onUpdateNow={handleUpdateNow} onLater={handleUpdateLater} />}
      {welcomeToast && (
        <div className="welcome-toast" role="status">
          <span>{welcomeToast}</span>
        </div>
      )}
      <AppShell
        active={constrainedActive}
        onChange={setActive}
        settings={data.settings}
        data={data}
        auth={auth}
        onLogout={handleLogout}
      >
        <AppErrorBoundary key={constrainedActive} onReset={() => setActive(ROLE_HOME[auth?.role] || 'dashboard')}>
          <Suspense fallback={<LoadingScreen />}>
            <div className="screen-stage">
              <Screen {...ScreenProps} />
            </div>
          </Suspense>
        </AppErrorBoundary>
      </AppShell>
    </>
  );
}
