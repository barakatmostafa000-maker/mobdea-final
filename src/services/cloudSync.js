import { isHttpUrl, normalizeHttpUrl, safeTrim } from '../utils/safety';

const timeoutFetch = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timer);
  }
};

const validateConfig = (settings = {}) => {
  const config = settings.cloudSync || {};
  const endpoint = normalizeHttpUrl(config.endpoint);
  const workspaceId = safeTrim(config.workspaceId, 80);
  const token = safeTrim(config.token, 160);
  if (!endpoint || !isHttpUrl(endpoint)) throw new Error('أدخل رابطًا صحيحًا يبدأ بـ http أو https');
  if (!workspaceId) throw new Error('أكمل مساحة العمل أولًا');
  if (!token) throw new Error('أكمل الرمز السري أولًا');
  return { endpoint, workspaceId, token };
};

const headersFor = (config) => ({
  'Content-Type': 'application/json',
  'X-Mobdea-Workspace': config.workspaceId,
  'X-Mobdea-Client': 'mobdea-mobile',
  ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
});

const buildUrl = (endpoint, path) => `${endpoint.replace(/\/$/, '')}${path}`;

export function cloudConfigured(settings = {}) {
  try {
    validateConfig(settings);
    return true;
  } catch {
    return false;
  }
}

export async function testCloudConnection(settings = {}) {
  const config = validateConfig(settings);
  const response = await timeoutFetch(buildUrl(config.endpoint, '/health'), {
    method: 'GET',
    headers: headersFor(config)
  });
  if (!response.ok) throw new Error(`فشل الاتصال بالخادم (${response.status})`);
  return response.json();
}

export async function pushCloudData(data) {
  const config = validateConfig(data.settings);
  const payload = {
    version: 8,
    workspaceId: config.workspaceId,
    updatedAt: new Date().toISOString(),
    data: {
      ...data,
      settings: {
        ...data.settings,
        cloudSync: { ...data.settings.cloudSync, token: '' }
      }
    }
  };
  const response = await timeoutFetch(buildUrl(config.endpoint, '/sync'), {
    method: 'PUT',
    headers: headersFor(config),
    body: JSON.stringify(payload)
  }, 20000);
  if (!response.ok) throw new Error(`فشل رفع البيانات (${response.status})`);
  return response.json();
}

export async function pullCloudData(settings = {}) {
  const config = validateConfig(settings);
  const response = await timeoutFetch(buildUrl(config.endpoint, '/sync'), {
    method: 'GET',
    headers: headersFor(config)
  }, 20000);
  if (response.status === 404) throw new Error('لا توجد نسخة سحابية محفوظة لهذه المساحة');
  if (!response.ok) throw new Error(`فشل تنزيل البيانات (${response.status})`);
  const payload = await response.json();
  if (!payload?.data) throw new Error('النسخة السحابية غير صالحة');
  return payload;
}
