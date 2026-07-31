import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import './styles/app.css';

const rootElement = document.getElementById('root');

function showFatalBootMessage(error) {
  if (!rootElement || rootElement.childElementCount > 0) return;
  rootElement.innerHTML = `<div class="fatal-screen" dir="rtl"><div class="fatal-card"><h1>تعذر بدء المنصة</h1><p>تم منع الشاشة البيضاء. أعد تشغيل التطبيق.</p><code>${String(error?.message || error || 'خطأ غير معروف').replace(/[<&]/g, '')}</code><button type="button" onclick="location.reload()">إعادة تشغيل التطبيق</button></div></div>`;
}

window.addEventListener('error', (event) => showFatalBootMessage(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalBootMessage(event.reason));

try {
  if (!rootElement) throw new Error('عنصر تشغيل المنصة غير موجود.');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
  );
} catch (error) {
  showFatalBootMessage(error);
}
