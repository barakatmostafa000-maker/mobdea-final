import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from './components/AppShell';
import LockScreen from './components/LockScreen';
import Placeholder from './pages/Placeholder';
import SharedAccess from './pages/SharedAccess';
import { loadAppData, saveAppData, resetAppData } from './services/storage';
import { checkForUpdate } from './services/updater';
import { speakWelcome } from './services/voice';
import { readShareFromLocation } from './services/share';
import { release } from './config/release';
import { ROLE_HOME, getRoleModules } from './utils/auth';

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
const QuestionBankManager = lazy(() => import('./pages/QuestionBankManager'));
const MapChallenge = lazy(() => import('./pages/MapChallenge'));
const ClassMode = lazy(() => import('./pages/ClassMode'));
const StudentCards = lazy(() => import('./pages/StudentCards'));
const Settings = lazy(() => import('./pages/Settings'));
const PortalPreview = lazy(() => import('./pages/PortalPreview'));
const DeviceDiagnostics = lazy(() => import('./pages/DeviceDiagnostics'));
const SmartAssistant = lazy(() => import('./pages/SmartAssistant'));
const ContentLibrary = lazy(() => import('./pages/ContentLibrary'));
const Updates = lazy(() => import('./pages/Updates'));

const LoadingScreen = () => <div className="loading-screen"><div className="loading-mark">م</div><h1>منصة المُبدع</h1><p>جارٍ تحميل الصفحة...</p></div>;

const AUTH_STORAGE_KEY = 'mobdea_mobile_auth_v1';

function readAuthFromStorage() {
  try {
    // "تذكرني" sessions are kept in localStorage so they survive app restarts;
    // regular sessions live only in sessionStorage for the current tab.
    const persisted = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    if (persisted) return JSON.parse(persisted);
    const raw = globalThis.sessionStorage?.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [data, setData] = useState(null);
  const [auth, setAuth] = useState(() => readAuthFromStorage());
  const rememberRef = useRef(Boolean(globalThis.localStorage?.getItem(AUTH_STORAGE_KEY)));
  const [welcomePlayed, setWelcomePlayed] = useState(false);
  const [shareState, setShareState] = useState(() => readShareFromLocation(globalThis.location));
  const autoCheckedRef = useRef(false);

  useEffect(() => { loadAppData().then(setData); }, []);

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
    setShareState(readShareFromLocation(globalThis.location));
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

  const updateData = async (next) => {
    setData(next);
    await saveAppData(next);
  };

  useEffect(() => {
    if (!data || !auth || welcomePlayed || !data.settings.welcomeVoice) return;
    const timer = setTimeout(() => {
      speakWelcome(data.settings);
      setWelcomePlayed(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, auth, welcomePlayed]);

  useEffect(() => {
    if (!data?.settings?.update?.autoCheck || !data) return undefined;
    let cancelled = false;
    const run = async () => {
      try {
        const result = await checkForUpdate(data.settings, release.appVersion);
        if (cancelled) return;
        const history = [{ checkedAt: new Date().toISOString(), version: result.version, available: result.available }, ...(data.updateHistory || [])].slice(0, 20);
        const next = {
          ...data,
          updateHistory: history,
          settings: {
            ...data.settings,
            update: {
              ...(data.settings.update || {}),
              manifestUrl: data.settings.update?.manifestUrl || release.manifestPath,
              autoCheck: true,
              lastAutoCheckAt: new Date().toISOString(),
              lastAutoCheckVersion: result.version,
              lastAutoCheckAvailable: result.available,
            }
          }
        };
        setData(next);
        await saveAppData(next);
      } catch {
        // silently ignore update check failures
      }
    };
    if (!autoCheckedRef.current) {
      autoCheckedRef.current = true;
      run();
    }
    const interval = setInterval(run, 60 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data]);

  const handleUnlock = (session, options = {}) => {
    const next = session || { role: 'admin' };
    rememberRef.current = Boolean(options.remember);
    setAuth(next);
    setActive(ROLE_HOME[next.role] || 'dashboard');
    if (shareState.kind === 'game') setActive('games');
    if (shareState.kind === 'lesson' || shareState.kind === 'portal') setActive('classMode');
  };

  const handleLogout = () => {
    rememberRef.current = false;
    setAuth(null);
    setWelcomePlayed(false);
    setActive('dashboard');
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

  const openScreenFromShare = (screen) => {
    const target = screen === 'games' ? 'games' : 'classMode';
    if (auth) setActive(target);
  };

  if (!data) return <LoadingScreen />;
  if (shareState.kind && !auth) {
    return <SharedAccess data={data} shareKind={shareState.kind} sharePayload={shareState.payload} onGoHome={goHomeFromShare} onOpenScreen={openScreenFromShare} />;
  }
  if (!auth) return <LockScreen data={data} onUnlock={handleUnlock} updateData={updateData} />;

  const common = { data, updateData, auth, role: auth.role };
  const screenProps = {
    dashboard: { data, navigate: setActive, auth },
    classMode: { ...common, navigate: setActive, shareState },
    students: common,
    studentCards: { data, auth },
    portalPreview: { data, auth },
    diagnostics: { data, auth },
    smartAssistant: { data, auth },
    contentLibrary: common,
    updates: common,
    sessions: common,
    attendance: common,
    gradeScanner: common,
    resultDetails: common,
    grades: common,
    payments: common,
    questionBank: common,
    games: { ...common, shareState },
    mapChallenge: common,
    messages: common,
    reports: { data, auth },
    settings: { ...common, resetAppData },
  };

  const screenMap = {
    dashboard: Dashboard,
    classMode: ClassMode,
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
    mapChallenge: MapChallenge,
    messages: Messages,
    reports: Reports,
    settings: Settings,
  };

  const constrainedActive = allowedModules && !allowedModules.has(active) ? 'dashboard' : active;
  const Screen = screenMap[constrainedActive] || Placeholder;
  const ScreenProps = screenProps[constrainedActive] || { title: 'قيد التطوير', subtitle: 'سيتم استكمال الوحدة في الإصدار التالي.' };

  return (
    <AppShell
      active={constrainedActive}
      onChange={setActive}
      settings={data.settings}
      data={data}
      auth={auth}
      onLogout={handleLogout}
    >
      <Suspense fallback={<LoadingScreen />}>
        <div key={constrainedActive} className="screen-stage">
          <Screen {...ScreenProps} />
        </div>
      </Suspense>
    </AppShell>
  );
}
