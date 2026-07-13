function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Mobdea-Workspace',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const url = new URL(request.url);
    const workspace = request.headers.get('X-Mobdea-Workspace') || 'default';
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.MOBDEA_TOKEN || token !== env.MOBDEA_TOKEN) return json({ error: 'unauthorized' }, 401);
    if (url.pathname === '/health') return json({ ok: true, service: 'mobdea-sync', time: new Date().toISOString() });
    if (url.pathname !== '/sync') return json({ error: 'not_found' }, 404);
    const key = `workspace:${workspace}`;
    if (request.method === 'GET') {
      const value = await env.MOBDEA_DATA.get(key, 'json');
      return value ? json(value) : json({ error: 'not_found' }, 404);
    }
    if (request.method === 'PUT') {
      const payload = await request.json();
      if (!payload?.data) return json({ error: 'invalid_payload' }, 400);
      await env.MOBDEA_DATA.put(key, JSON.stringify(payload));
      return json({ ok: true, workspace, updatedAt: payload.updatedAt });
    }
    return json({ error: 'method_not_allowed' }, 405);
  }
};
