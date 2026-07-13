const timeoutFetch = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const headersFor = (config) => ({
  'Content-Type': 'application/json',
  'X-Mobdea-Workspace': config.workspaceId || 'default',
  ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
});

export function cloudConfigured(settings = {}) {
  const config = settings.cloudSync || {};
  return Boolean(config.endpoint && config.workspaceId && config.token);
}

export async function testCloudConnection(settings = {}) {
  const config = settings.cloudSync || {};
  if (!cloudConfigured(settings)) throw new Error('أكمل رابط المزامنة ومساحة العمل والرمز السري أولًا');
  const response = await timeoutFetch(`${config.endpoint.replace(/\/$/, '')}/health`, {
    method: 'GET',
    headers: headersFor(config)
  });
  if (!response.ok) throw new Error(`فشل الاتصال بالخادم (${response.status})`);
  return response.json();
}

export async function pushCloudData(data) {
  const config = data.settings?.cloudSync || {};
  if (!cloudConfigured(data.settings)) throw new Error('المزامنة السحابية غير مُعدة');
  const payload = {
    version: 7,
    workspaceId: config.workspaceId,
    updatedAt: new Date().toISOString(),
    data: {
      ...data,
      settings: {
        ...data.settings,
        cloudSync: { ...config, token: '' }
      }
    }
  };
  const response = await timeoutFetch(`${config.endpoint.replace(/\/$/, '')}/sync`, {
    method: 'PUT',
    headers: headersFor(config),
    body: JSON.stringify(payload)
  }, 20000);
  if (!response.ok) throw new Error(`فشل رفع البيانات (${response.status})`);
  return response.json();
}

export async function pullCloudData(settings = {}) {
  const config = settings.cloudSync || {};
  if (!cloudConfigured(settings)) throw new Error('المزامنة السحابية غير مُعدة');
  const response = await timeoutFetch(`${config.endpoint.replace(/\/$/, '')}/sync`, {
    method: 'GET',
    headers: headersFor(config)
  }, 20000);
  if (response.status === 404) throw new Error('لا توجد نسخة سحابية محفوظة لهذه المساحة');
  if (!response.ok) throw new Error(`فشل تنزيل البيانات (${response.status})`);
  const payload = await response.json();
  if (!payload?.data) throw new Error('النسخة السحابية غير صالحة');
  return payload;
}
