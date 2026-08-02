import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import './styles/app.css';
import './styles/v103.css';

const rootElement = document.getElementById('root');
let bootCompleted = false;

function showFatalBootMessage(error) {
  if (!rootElement || bootCompleted) return;
  rootElement.innerHTML = `<div class="fatal-screen" dir="rtl"><div class="fatal-card"><h1>تعذر بدء المنصة</h1><p>تم منع الشاشة البيضاء. أعد تشغيل التطبيق.</p><code>${String(error?.message || error || 'خطأ غير معروف').replace(/[<&]/g, '')}</code><button type="button" onclick="location.reload()">إعادة تشغيل التطبيق</button></div></div>`;
}

window.addEventListener('error', (event) => showFatalBootMessage(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showFatalBootMessage(event.reason));

// A native tablet with an outdated/corrupt WebView cache used to remain white
// forever. Keep a visible watchdog outside React so startup failures are never
// silent and the teacher can retry or clear only the web cache.
setTimeout(() => {
  if (!bootCompleted && rootElement && !rootElement.querySelector('.fatal-screen')) {
    showFatalBootMessage(new Error('لم تكتمل تهيئة واجهة المنصة خلال الوقت المتوقع.'));
  }
}, 12000);

try {
  if (!rootElement) throw new Error('عنصر تشغيل المنصة غير موجود.');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
  );
  requestAnimationFrame(() => {
    bootCompleted = true;
    document.documentElement.dataset.mobdeaBooted = 'true';
  });
} catch (error) {
  showFatalBootMessage(error);
}
