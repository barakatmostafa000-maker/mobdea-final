
import React from 'react';
import { identity } from '../config/identity';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Mobdea fatal render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <div className="fatal-screen" dir="rtl">
      <div className="fatal-card">
        <img src={identity.portrait} alt={identity.teacherName} />
        <h1>تعذر فتح هذه الشاشة</h1>
        <p>تم منع الشاشة البيضاء. أعد فتح الصفحة، ولو تكرر الخطأ أرسل نص الرسالة التالية:</p>
        <code>{String(this.state.error?.message || this.state.error)}</code>
        <button onClick={() => window.location.reload()}>إعادة تشغيل التطبيق</button>
      </div>
    </div>;
  }
}
