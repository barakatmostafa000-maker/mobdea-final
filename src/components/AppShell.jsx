import { useEffect, useMemo, useState } from 'react';
import {
  Home, Users, CalendarDays, ClipboardCheck, GraduationCap, WalletCards,
  Gamepad2, MessageCircle, BarChart3, Settings, Menu, X, Presentation,
  IdCard, ScanLine, ListChecks, Eye, Stethoscope, ChevronLeft, Sparkles,
  ShieldCheck, Bell, BrainCircuit, MapPinned, BookOpen, DownloadCloud, LogOut, PenTool
} from 'lucide-react';
import { identity } from '../config/identity';
import { release } from '../config/release';
import { ROLE_LABELS, getRoleModules } from '../utils/auth';

const baseItems = [
  ['dashboard', 'الرئيسية', Home, 'اليوم والحصة الحالية'],
  ['classMode', 'وضع الحصة', Presentation, 'الشرح والتفاعل والحضور'],
  ['whiteboard', 'السبورة', PenTool, 'الرسم والكتابة والشرح'],
  ['students', 'الطلاب', Users, 'البيانات والمجموعات'],
  ['studentCards', 'كروت الطلاب', IdCard, 'QR والطباعة'],
  ['sessions', 'الحصص والمجموعات', CalendarDays, 'الجدول والحصة الحالية'],
  ['attendance', 'الحضور والغياب', ClipboardCheck, 'سجل الحصص'],
  ['gradeScanner', 'رصد الدرجات بالكود', ScanLine, 'رصد سؤالًا بسؤال'],
  ['resultDetails', 'تحليل الأخطاء', ListChecks, 'الدروس والموضوعات الضعيفة'],
  ['grades', 'الدرجات والامتحانات', GraduationCap, 'النتائج والترتيب'],
  ['payments', 'الحسابات', WalletCards, 'الدفع بالحصة والمستحقات'],
  ['games', 'الألعاب التعليمية', Gamepad2, 'الجولات والتحديات'],
  ['mapChallenge', 'تحدي الخرائط', MapPinned, 'الدول والمواقع والظاهرات'],
  ['messages', 'أولياء الأمور', MessageCircle, 'الرسائل والتنبيهات'],
  ['reports', 'التقارير', BarChart3, 'متابعة الأداء'],
  ['contentLibrary', 'الشرح والمحتوى', BookOpen, 'الدروس والملفات والخرائط'],
  ['smartAssistant', 'مساعد المُبدع', BrainCircuit, 'تحليل وتنبيهات ذكية'],
  ['updates', 'تحديث التطبيق', DownloadCloud, 'فحص وتنزيل آخر إصدار'],
  ['portalPreview', 'معاينة الصلاحيات', Eye, 'الطالب وولي الأمر'],
  ['diagnostics', 'تشخيص الجهاز', Stethoscope, 'الكاميرا والصوت والاتصال'],
  ['settings', 'الإعدادات', Settings, 'الحماية والتحكم']
];

const moduleMap = {
  grades: 'grades', payments: 'payments', games: 'games',
  messages: 'messages', reports: 'reports'
};

export default function AppShell({ active, onChange, children, settings, data, auth, onLogout }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const roleModules = useMemo(() => getRoleModules(auth?.role), [auth?.role]);
  const items = useMemo(() => baseItems.filter(([id]) => {
    const key = moduleMap[id];
    const moduleVisible = !key || settings?.visibleModules?.[key] !== false;
    const roleVisible = !roleModules || roleModules.has(id);
    return moduleVisible && roleVisible;
  }), [settings, roleModules]);

  useEffect(() => {
    const onEscape = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const currentSession = data?.sessions?.find((session) => session.current);
  const readyNotifications = (data?.notifications || []).filter((item) => item.status === 'ready').length;

  const select = (id) => {
    onChange(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const roleLabel = ROLE_LABELS[auth?.role] || 'المستخدم';

  if (active === 'classMode' || active === 'whiteboard') {
    return <div className="app-shell lesson-mode-shell">{children}</div>;
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="mobile-header">
        <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu size={23} /></button>
        <div className="mobile-brand-copy">
          <img src={identity.portrait} alt={identity.teacherName} className="mobile-brand-avatar" />
          <div>
            <strong>{identity.teacherName}</strong>
            <span>{currentSession ? currentSession.group : identity.teacherTitle}</span>
          </div>
        </div>
        <div className="mobile-header-actions">
          <span className="mobile-role-pill" aria-label={`الدور الحالي: ${roleLabel}`}>{roleLabel}</span>
          <button className="mobile-alert-button" onClick={() => select('messages')} aria-label="التنبيهات">
            <Bell size={20} />
            {readyNotifications > 0 && <b>{readyNotifications}</b>}
          </button>
        </div>
      </header>

      {open && <button className="drawer-overlay" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" />}

      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <button
            className="sidebar-desktop-toggle"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          ><Menu size={22} /></button>
          <button className="drawer-close" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={21} /></button>
          <div className="brand-panel">
            <button className="brand-avatar brand-avatar-photo" type="button" onClick={() => select('dashboard')} aria-label="الانتقال إلى الرئيسية">
              <img src={identity.logo || identity.icon} alt={identity.schoolName} />
              <i><Sparkles size={13} /></i>
            </button>
            <div>
              <h1>المُبدع</h1>
              <p>{identity.teacherName.replace('المُبدع ', '')}</p>
              <small>{identity.teacherTitle}</small>
            </div>
          </div>

          <div className="sidebar-role-card">
            <ShieldCheck size={18} />
            <span>
              <strong>{roleLabel}</strong>
              <small>{auth?.displayName || auth?.studentId ? 'تم تسجيل الدخول بنجاح' : 'جلسة نشطة'}</small>
            </span>
          </div>

          <button className="session-mini-card" onClick={() => select('classMode')}>
            <span className="session-mini-icon"><Presentation size={19} /></span>
            <span>
              <small>{currentSession ? 'الحصة الحالية' : 'لا توجد حصة حالية'}</small>
              <strong>{currentSession?.group || 'اختر حصة للبدء'}</strong>
            </span>
            <ChevronLeft size={17} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
          {items.map(([id, label, Icon, hint]) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => select(id)}>
              <span className="nav-icon"><Icon size={19} /></span>
              <span className="nav-copy"><strong>{label}</strong><small>{hint}</small></span>
              <ChevronLeft className="nav-arrow" size={16} />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div><ShieldCheck size={18} /><span><strong>الإدارة محمية</strong><small>PIN وقفل تلقائي</small></span></div>
          <b>{release.footerLabel}</b>
          <button className="logout-btn" type="button" onClick={onLogout}><LogOut size={16} /> تسجيل الخروج</button>
        </div>
      </aside>

      <main className="app-content">{children}</main>
    </div>
  );
}
