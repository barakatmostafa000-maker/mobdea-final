from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

notifications = root / "src/services/notifications.js"
if not notifications.is_file():
    raise SystemExit("notifications.js missing")

source = notifications.read_text(encoding="utf-8")
if not re.search(r"\bexport\s+(?:async\s+)?function\s+sendAbsenceWhatsApp\b", source):
    source = source.rstrip() + r"""

// RUN18_ATTENDANCE_WHATSAPP_EXPORT_CLOSURE_V1
export function sendAbsenceWhatsApp(student = {}, session = {}, date = '') {
  const rawPhone = String(student?.guardianPhone || '').trim();
  const normalized = rawPhone.replace(/\D/g, '').replace(/^0/, '20');
  if (!normalized) {
    return { ok: false, message: 'لا يوجد رقم هاتف مسجل لولي الأمر.' };
  }
  const safeDate = String(date || new Date().toISOString().slice(0, 10));
  const message = cleanWhatsAppMessage(
    buildAttendanceMessage(student?.name || 'الطالب', 'absent', safeDate),
  );
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { ok: false, message: 'فتح واتساب متاح من التطبيق أو المتصفح فقط.' };
  }
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { ok: true, message: `تم فتح واتساب لإبلاغ ولي أمر ${student?.name || 'الطالب'}.` };
}
"""
    notifications.write_text(source, encoding="utf-8")

attendance = root / "src/pages/Attendance.jsx"
if not attendance.is_file() or "sendAbsenceWhatsApp" not in attendance.read_text(encoding="utf-8"):
    raise SystemExit("Attendance WhatsApp closure is not wired")

gradle = root / "android/app/build.gradle"
text = gradle.read_text(encoding="utf-8")
bad = """    lint {
        abortOnError true
        checkReleaseBuilds true
        warningsAsErrors false
    }
    }
}

repositories {"""
good = """    lint {
        abortOnError true
        checkReleaseBuilds true
        warningsAsErrors false
    }
}

repositories {"""
if bad in text:
    gradle.write_text(text.replace(bad, good, 1), encoding="utf-8")
elif "android {" not in text or "defaultConfig {" not in text:
    raise SystemExit("Android Gradle structure is not recognized")

print("R19 RUN18/V6 base closures: PASS")
