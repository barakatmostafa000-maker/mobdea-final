export const timeoutFetch = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالخادم.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const buildCloudUrl = (endpoint, path) => `${endpoint.replace(/\/$/, '')}${path}`;
