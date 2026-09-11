// PROJECT13_NATIVE_BARCODE_SCANNER_V1
import { Capacitor, registerPlugin } from '@capacitor/core';
import { resolveStudentByCode, resolveStudentFromQrPayload } from '../utils/auth';

const NativeBarcode = registerPlugin('MobdeaBarcodeScanner');

function digits(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? match[1] : '';
}

export function resolveStudentFromBarcode(data, rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  const direct = resolveStudentFromQrPayload(data, raw);
  if (direct) return direct;

  try {
    const url = new URL(raw);
    const candidates = [
      url.searchParams.get('code'),
      url.searchParams.get('studentCode'),
      url.pathname,
      url.host,
    ];
    for (const candidate of candidates) {
      const code = digits(candidate);
      const student = resolveStudentByCode(data, code);
      if (student) return student;
    }
  } catch {
    // Not a URL; continue with numeric fallback.
  }

  return resolveStudentByCode(data, digits(raw));
}

export async function scanStudentBarcodeNative() {
  if (!Capacitor.isNativePlatform()) return { supported: false };
  try {
    const result = await NativeBarcode.scan();
    return {
      supported: true,
      cancelled: result?.cancelled === true,
      rawValue: String(result?.rawValue || ''),
      format: String(result?.format || ''),
    };
  } catch (error) {
    return { supported: true, error: error?.message || 'تعذر فتح ماسح الباركود.' };
  }
}
