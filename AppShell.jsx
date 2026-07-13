import { useState } from 'react';
import { Home, Users, CalendarDays, ClipboardCheck, GraduationCap, WalletCards, Gamepad2, MessageCircle, BarChart3, Settings, Menu, X, Presentation, IdCard, ScanLine, ListChecks, Eye, Stethoscope } from 'lucide-react';

const baseItems = [
  ['dashboard', 'الرئيسية', Home],
  ['classMode', 'وضع الحصة', Presentation],
  ['students', 'الطلاب', Users],
  ['studentCards', 'كروت الطلاب', IdCard],
  ['portalPreview', 'معاينة الطالب وولي الأمر', Eye],
  ['diagnostics', 'تشخيص الجهاز', Stethoscope],
  ['sessions', 'الحصص والمجموعات', CalendarDays],
  ['attendance', 'الحضور والغياب', ClipboardCheck],
  ['gradeScanner', 'رصد الدرجات بالكود', ScanLine],
  ['resultDetails', 'تحليل الأسئلة الخاطئة', ListChecks],
  ['grades', 'الدرجات والامتحانات', GraduationCap],
  ['payments', 'الحسابات', WalletCards],
  ['games', 'الألعاب التعليمية', Gamepad2],
  ['messages', 'أولياء الأمور', MessageCircle],
  ['reports', 'التقارير', BarChart3],
  ['settings', 'الإعدادات', Settings]
];

const moduleMap = {
  grades: 'grades',
  payments: 'payments',
  games: 'games',
  messages: 'messages',
  reports: 'reports'
};

export default function AppShell({ active, onChange, children, settings }) {
  const [open, setOpen] = useState(false);
  const items = baseItems.filter(([id]) => {
    const key = moduleMap[id];
    return !key || settings?.visibleModules?.[key] !== false;
  });

  const select = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu size={24} /></button>
        <div><strong>منصة المُبدع</strong><span>المُبدع لتعليم ممتع</span></div>
      </header>

      {open && <button className="drawer-overlay" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand-panel">
          <button className="drawer-close" onClick={() => setOpen(false)}><X /></button>
          <div className="brand-mark">م</div>
          <div><h1>المُبدع</h1><p>مصطفى بركات</p></div>
        </div>

        <nav>
          {items.map(([id, label, Icon]) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => select(id)}>
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer"><strong>Mobile V7</strong><span>Android والمزامنة السحابية</span></div>
      </aside>

      <main className="app-content">{children}</main>
    </div>
  );
}
