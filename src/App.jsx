import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import LockScreen from './components/LockScreen';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Sessions from './pages/Sessions';
import Grades from './pages/Grades';
import GradeScanner from './pages/GradeScanner';
import ResultDetails from './pages/ResultDetails';
import Payments from './pages/Payments';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import Games from './pages/Games';
import QuestionBankManager from './pages/QuestionBankManager';
import MapChallenge from './pages/MapChallenge';
import ClassMode from './pages/ClassMode';
import StudentCards from './pages/StudentCards';
import Settings from './pages/Settings';
import PortalPreview from './pages/PortalPreview';
import DeviceDiagnostics from './pages/DeviceDiagnostics';
import SmartAssistant from './pages/SmartAssistant';
import ContentLibrary from './pages/ContentLibrary';
import Updates from './pages/Updates';
import Placeholder from './pages/Placeholder';
import { loadAppData, saveAppData, resetAppData } from './services/storage';
import { speakWelcome, unlockVoice } from './services/voice';

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [data, setData] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [welcomePlayed, setWelcomePlayed] = useState(false);

  useEffect(() => {
    loadAppData().then(setData).catch((error) => {
      console.error('Mobdea startup data error', error);
      window.__mobdeaShowBootError?.(error?.message || 'تعذر قراءة بيانات التطبيق');
    });
  }, []);

  useEffect(() => {
    const unlock = () => unlockVoice();
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!data?.settings?.lockEnabled || !unlocked) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setUnlocked(false), Math.max(1, Number(data.settings.lockAfterMinutes || 10)) * 60 * 1000);
    };
    const events = ['pointerdown','keydown','touchstart'];
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

  if (!data) return <div className="loading-screen"><div className="loading-mark">م</div><h1>منصة المُبدع</h1><p>جارٍ تجهيز التطبيق...</p></div>;
  if (data.settings.lockEnabled && !unlocked) return <LockScreen correctPin={data.settings.adminPin} onUnlock={()=>setUnlocked(true)} />;

  const common = { data, updateData };
  const pages = {
    dashboard: <Dashboard data={data} navigate={setActive} />,
    classMode: <ClassMode {...common} navigate={setActive} />,
    students: <Students {...common} />,
    studentCards: <StudentCards data={data} />,
    portalPreview: <PortalPreview data={data} />,
    diagnostics: <DeviceDiagnostics data={data} />,
    smartAssistant: <SmartAssistant data={data} />,
    contentLibrary: <ContentLibrary {...common} />,
    updates: <Updates {...common} />,
    sessions: <Sessions {...common} />,
    attendance: <Attendance {...common} />,
    gradeScanner: <GradeScanner {...common} />,
    resultDetails: <ResultDetails {...common} />,
    grades: <Grades {...common} />,
    payments: <Payments {...common} />,
    questionBank: <QuestionBankManager {...common} />,
    games: <Games {...common} />,
    mapChallenge: <MapChallenge {...common} />,
    messages: <Messages {...common} />,
    reports: <Reports data={data} />,
    settings: <Settings {...common} resetAppData={resetAppData} />
  };

  return <AppShell active={active} onChange={setActive} settings={data.settings} data={data}>{pages[active] || <Placeholder title="قيد التطوير" subtitle="سيتم استكمال الوحدة في الإصدار التالي." />}</AppShell>;
}
