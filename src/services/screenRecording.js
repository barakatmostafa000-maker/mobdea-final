import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeScreenRecorder = registerPlugin('MobdeaScreenRecorder');

export function nativeScreenRecordingAvailable() {
  return Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('MobdeaScreenRecorder');
}

export async function startNativeScreenRecording({ title = 'الحصة', withAudio = true } = {}) {
  if (!nativeScreenRecordingAvailable()) {
    throw new Error('تسجيل الشاشة الأصلي متاح داخل تطبيق Android فقط.');
  }
  return NativeScreenRecorder.start({ title, withAudio });
}

export async function pauseNativeScreenRecording() {
  if (!nativeScreenRecordingAvailable()) return false;
  await NativeScreenRecorder.pause();
  return true;
}

export async function resumeNativeScreenRecording() {
  if (!nativeScreenRecordingAvailable()) return false;
  await NativeScreenRecorder.resume();
  return true;
}

export async function stopNativeScreenRecording() {
  if (!nativeScreenRecordingAvailable()) {
    throw new Error('لا يوجد تسجيل Android نشط.');
  }
  const result = await NativeScreenRecorder.stop();
  const source = Capacitor.convertFileSrc(result.path || '');
  if (!source) throw new Error('تعذر الوصول إلى ملف تسجيل الحصة.');
  const response = await fetch(source);
  if (!response.ok) throw new Error('تعذر قراءة ملف تسجيل الحصة من الجهاز.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('ملف تسجيل الحصة فارغ.');
  return {
    blob,
    name: result.fileName || `mobdea-recording-${Date.now()}.mp4`,
    type: result.mimeType || blob.type || 'video/mp4',
    durationSeconds: Math.max(1, Math.round(Number(result.durationMs || 0) / 1000)),
  };
}
