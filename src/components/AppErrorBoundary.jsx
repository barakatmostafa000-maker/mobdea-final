import { Component } from 'react';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';
import { identity } from '../config/identity';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      globalThis.localStorage?.setItem('mobdea_last_runtime_error', JSON.stringify({
        message: String(error?.message || error || 'Unknown error').slice(0, 500),
        stack: String(error?.stack || '').slice(0, 4000),
        componentStack: String(info?.componentStack || '').slice(0, 4000),
        createdAt: new Date().toISOString(),
      }));
    } catch {
      // Diagnostics must never cause another failure.
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="runtime-error-screen" role="alert">
        <img src={identity.logo || identity.icon} alt={identity.schoolName} />
        <AlertTriangle size={42} />
        <h2>تعذر عرض هذه الصفحة</h2>
        <p>{this.state.error?.message || 'حدث خطأ غير متوقع داخل الواجهة.'}</p>
        <div>
          <button className="primary-btn" type="button" onClick={this.reset}><Home size={17}/> العودة للرئيسية</button>
          <button className="secondary-btn" type="button" onClick={() => globalThis.location?.reload?.()}><RefreshCcw size={17}/> إعادة تشغيل التطبيق</button>
        </div>
        <small>تم حفظ تفاصيل الخطأ محليًا في تشخيص الجهاز، ولم يتم حذف أي بيانات.</small>
      </section>
    );
  }
}
