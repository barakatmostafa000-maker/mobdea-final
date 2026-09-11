import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./styles/app.css";
import "./styles/v103.css";
import "./styles/v104.css";
import "./styles/v105.css";
import "./styles/v106.css";
import "./styles/v107.css";
import "./styles/v109.css";
import "./styles/v110.css";
import "./styles/v111.css";
import "./styles/r18-classmode-viewport-fix.css";
import "./styles/r19-classmode-phase1.css";
import "./styles/r19-master-repairs.css";
import "./styles/r19-targeted-fixes.css";
import "./styles/student-cards-print.css";
import "./styles/r19-user-fix7.css";
import "./styles/r19-fix8-native.css";
import { installViewportMetrics } from "./services/viewport";

import "./services/r19InteractionFixes.js";
import './styles/project01-whiteboard.css';
import './styles/project02-pdf-image-viewer.css';
import './styles/project03-student-panels.css';
import './styles/project04-card-layout.css';
import './services/project04CardLayout.js';
import './styles/project05-student-card-duplex.css';
import './styles/project06-teaching-maps.css';
import './styles/project07-map-challenge-engine.css';
import './styles/project08-ocr-question-import.css';
import './styles/project09-dashboard-responsive.css';
import './styles/project10-online-class.css';
import './styles/project11-student-sync.css';
import './styles/project12-classmode-cloud-voice.css';
import './styles/project13-pdf-focus-attendance-links-exams.css';
import './styles/project14-youtube-auto-sync.css';
import './styles/r19-final-runtime-fixes.css';
import './styles/r20-fix01-core-runtime.css';
import './services/r20RuntimeCore.js';
import './styles/r20-fix02-unified-classmode-layout.css';
import './services/r20UnifiedClassModeLayout.js';
import './styles/r20-fix03-student-management.css';
import './services/r20StudentManagement.js';
import './services/r20PortalAccountRuntime.js';
import './styles/r20-fix04-accounts.css';
import './services/r20PortalDashboard.js';
import './styles/r20-fix05-role-dashboard.css';
import './services/r20TeacherTabletDashboard.js';
import './styles/r20-fix06-teacher-tablet-dashboard.css';
import './services/r20PdfGestures.js';
import './styles/r20-fix07-pdf-gestures.css';
import './services/r20PageOcrPipeline.js';
import './services/r20OcrUiGuard.js';
import './styles/r20-fix08-ocr-page-questions.css';
import './services/r20WhiteboardRuntime.js';
import './styles/r20-fix09-whiteboard.css';
import './services/r20EducationalCards.js';
import './styles/r20-fix10-educational-cards.css';
import './services/r20CountryCards.js';
import './styles/r20-fix11-country-cards.css';
import './services/r20MapsRuntime.js';
import './styles/r20-fix12-maps.css';
import './services/r20AtlasRuntime.js';
import './styles/r20-fix13-atlas.css';
import './services/r20GeographyTruth.js';
import './services/r20GeographyCorrectnessRuntime.js';
import './styles/r20-fix14-geography-correctness.css';
import './services/r20MapChallengeRuntime.js';
import './styles/r20-fix15-map-challenge.css';
import './services/r20MapChallengeNaturalLayers.js';
import './styles/r20-fix16-map-natural-layers.css';
import './services/r20ImageMode.js';
import './styles/r20-fix16-image-mode.css';
import './services/r20MediaControls.js';
import './services/r20PowerPointMode.js';
import './styles/r20-fix17-media.css';
import './services/r20GamesRuntime.js';
import './styles/r20-fix18-games.css';
import './services/r20QuestionBankPipeline.js';
import './services/r20ExamTracking.js';
import './services/r20ReportsWhatsApp.js';
import './styles/r20-fix21-reports-whatsapp.css';
import './services/r20RemedialAssistant.js';
import './styles/r20-fix22-remedial-assistant.css';
import './services/r20DuplexPrinting.js';
import './styles/r20-fix23-duplex-print.css';
import './services/r20MobdeaOnline.js';
import './styles/r20-fix24-mobdea-online.css';
import './services/r20MonthlyEvaluation.js';
import './styles/r20-fix25-monthly-evaluation.css';
import './services/r20CriticalViewGuard.js';
import './services/r20PortalLoginBridge.js';
import './services/r20PortalScopeGuard.js';
import './styles/r20-audit-phase01-08.css';
installViewportMetrics();

const rootElement = document.getElementById("root");
let bootCompleted = false;

function showFatalBootMessage(error) {
  if (!rootElement || bootCompleted) return;
  rootElement.innerHTML = `<div class="fatal-screen" dir="rtl"><div class="fatal-card"><h1>تعذر بدء المنصة</h1><p>تم منع الشاشة البيضاء. أعد تشغيل التطبيق.</p><code>${String(error?.message || error || "خطأ غير معروف").replace(/[<&]/g, "")}</code><button type="button" onclick="location.reload()">إعادة تشغيل التطبيق</button></div></div>`;
}

window.addEventListener("error", (event) =>
  showFatalBootMessage(event.error || event.message),
);
window.addEventListener("unhandledrejection", (event) =>
  showFatalBootMessage(event.reason),
);

setTimeout(() => {
  if (
    !bootCompleted &&
    rootElement &&
    !rootElement.querySelector(".fatal-screen")
  ) {
    showFatalBootMessage(
      new Error("لم تكتمل تهيئة واجهة المنصة خلال الوقت المتوقع."),
    );
  }
}, 12000);

try {
  if (!rootElement) throw new Error("عنصر تشغيل المنصة غير موجود.");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
  requestAnimationFrame(() => {
    bootCompleted = true;
    document.documentElement.dataset.mobdeaBooted = "true";
  });
} catch (error) {
  showFatalBootMessage(error);
}
