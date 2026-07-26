import { lazy, Suspense, useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import LockScreen from './components/LockScreen';
import Placeholder from './pages/Placeholder';
import { loadAppData, saveAppData, resetAppData } from './services/storage';
import { speakWelcome } from './services/voice';

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

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [data, setData] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [welcomePlayed, setWelcomePlayed] = useState(false);

  useEffect(() => { loadAppData().then(setData); }, []);

  useEffect(() => {
    if (!data?.settings?.lockEnabled || !unlocked) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setUnlocked(false), Math.max(1, Number(data.settings.lockAfterMinutes || 10)) * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => { clearTimeout(timer); events.forEach((event) => window.removeEventListener(event, resetTimer)); };
  }, [data?.settings?.lockEnabled, data?.settings?.lockAfterMinutes, unlocked]);

  const updateData = async (next) => {
    setData(next);
    await saveAppData(next);
  };

  useEffect(() => {
    if (!data || !unlocked || welcomePlayed || !data.settings.welcomeVoice) return;
    const timer = setTimeout(() => {
      speakWelcome(data.settings);
      setWelcomePlayed(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, unlocked, welcomePlayed]);

  if (!data) return <LoadingScreen />;
  if (data.settings.lockEnabled && !unlocked) return <LockScreen correctPin={data.settings.adminPin} onUnlock={() => setUnlocked(true)} />;

  const common = { data, updateData };
  const screenProps = {
    dashboard: { data, navigate: setActive },
    classMode: { ...common, navigate: setActive },
    students: common,
    studentCards: { data },
    portalPreview: { data },
    diagnostics: { data },
    smartAssistant: { data },
    contentLibrary: common,
    updates: common,
    sessions: common,
    attendance: common,
    gradeScanner: common,
    resultDetails: common,
    grades: common,
    payments: common,
    questionBank: common,
    games: common,
    mapChallenge: common,
    messages: common,
    reports: { data },
    settings: { ...common, resetAppData }
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
    settings: Settings
  };

  const ActiveScreen = screenMap[active] || Placeholder;
  const props = screenProps[active] || { title: 'قيد التطوير', subtitle: 'سيتم استكمال الوحدة في الإصدار التالي.' };

  return (
    <AppShell active={active} onChange={setActive} settings={data.settings} data={data}>
      <Suspense fallback={<LoadingScreen />}>
        <ActiveScreen {...props} />
      </Suspense>
    </AppShell>
  );
}
