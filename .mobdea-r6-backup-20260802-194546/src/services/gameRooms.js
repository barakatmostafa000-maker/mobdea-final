import {
  buildCloudUrl,
  cloudHeaders,
  timeoutFetch,
  validateCloudConfig,
} from './cloudSync';
/* LOCAL_SAFE_TRIM_V1 */
function safeTrim(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));
}

const GAME_TOKEN_HEADER = 'X-Mobdea-Game-Token';
const GAME_WORKSPACE_HEADER = 'X-Mobdea-Workspace';
const GAME_CLIENT_HEADER = 'X-Mobdea-Client';

const DEFAULT_POLL_MS = 1400;

async function readErrorBody(response, fallback) {
  try {
    const body = await response.json();
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

function publicConfig(configLike = {}) {
  const endpoint = String(
    configLike.endpoint || '',
  ).replace(/\/$/, '');

  const workspaceId = safeTrim(
    configLike.workspaceId || '',
    80,
  );

  if (!/^https:\/\/.+/i.test(endpoint)) {
    throw new Error(
      'رابط الخادم غير صالح. يجب أن يبدأ بـ HTTPS.',
    );
  }

  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId)) {
    throw new Error('معرّف مساحة العمل غير صالح.');
  }

  return {
    endpoint,
    workspaceId,
  };
}

function gameHeaders(config, token = '', extra = {}) {
  return {
    ...cloudHeaders(config),
    'Content-Type': 'application/json',
    [GAME_WORKSPACE_HEADER]: config.workspaceId,
    [GAME_CLIENT_HEADER]: 'mobdea-game/1',
    ...(token
      ? { [GAME_TOKEN_HEADER]: token }
      : {}),
    ...extra,
  };
}

export async function createGameRoom(
  settings,
  metadata = {},
) {
  const config = validateCloudConfig(settings);

  const response = await timeoutFetch(
    buildCloudUrl(config.endpoint, '/game/rooms'),
    {
      method: 'POST',
      headers: gameHeaders(config),
      body: JSON.stringify({
        title: safeTrim(
          metadata.title || 'تحدي مباشر',
          140,
        ),
        teacherName: safeTrim(
          metadata.teacherName ||
            metadata.hostName ||
            'المعلم',
          80,
        ),
        mode: safeTrim(
          metadata.mode || 'individual',
          30,
        ),
        teamMode: Boolean(metadata.teamMode),
        teams: Array.isArray(metadata.teams)
          ? metadata.teams
          : [],
        maxParticipants: Number(
          metadata.maxParticipants || 40,
        ),
        ttlSeconds: Number(
          metadata.ttlSeconds || 6 * 60 * 60,
        ),
        state:
          metadata.state &&
          typeof metadata.state === 'object'
            ? metadata.state
            : {},
      }),
    },
    20000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر إنشاء غرفة اللعب (${response.status}).`,
      ),
    );
  }

  return {
    ...(await response.json()),
    endpoint: config.endpoint,
    workspaceId: config.workspaceId,
  };
}

export async function joinGameRoom(
  configLike,
  joinCode,
  profile = {},
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      '/game/rooms/join',
    ),
    {
      method: 'POST',
      headers: gameHeaders(config),
      body: JSON.stringify({
        joinCode: safeTrim(joinCode, 12),
        displayName: safeTrim(
          profile.displayName ||
            profile.studentName ||
            profile.name,
          80,
        ),
        studentId: safeTrim(
          profile.studentId ||
            profile.studentCode ||
            '',
          80,
        ),
        team: safeTrim(profile.team || '', 40),
      }),
    },
    20000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر دخول غرفة اللعب (${response.status}).`,
      ),
    );
  }

  return {
    ...(await response.json()),
    endpoint: config.endpoint,
    workspaceId: config.workspaceId,
  };
}

export async function fetchGameState(
  configLike,
  roomId,
  token,
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/state`,
    ),
    {
      method: 'GET',
      headers: gameHeaders(config, token),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر قراءة حالة اللعبة (${response.status}).`,
      ),
    );
  }

  return response.json();
}

export async function updateGameState(
  configLike,
  roomId,
  teacherToken,
  patch = {},
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/state`,
    ),
    {
      method: 'PATCH',
      headers: gameHeaders(config, teacherToken),
      body: JSON.stringify({
        status: patch.status,
        state:
          patch.state &&
          typeof patch.state === 'object'
            ? patch.state
            : undefined,
        questionId: patch.questionId,
        answerKey: patch.answerKey,
        pointsPerCorrect: patch.pointsPerCorrect,
      }),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر تحديث حالة اللعبة (${response.status}).`,
      ),
    );
  }

  return response.json();
}

export { DEFAULT_POLL_MS };


/* MOBDEA_GAME_SERVICE_PART_2 */

export async function fetchGameParticipants(
  configLike,
  roomId,
  token,
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/participants`,
    ),
    {
      method: 'GET',
      headers: gameHeaders(config, token),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر جلب المشاركين (${response.status}).`,
      ),
    );
  }

  return response.json();
}

export async function submitGameAnswer(
  configLike,
  roomId,
  participantToken,
  answerData = {},
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/answer`,
    ),
    {
      method: 'POST',
      headers: gameHeaders(config, participantToken),
      body: JSON.stringify({
        questionId: safeTrim(
          answerData.questionId || '',
          100,
        ),
        answer:
          answerData.answer ??
          answerData.value ??
          '',
        elapsedMs: Math.max(
          0,
          Number(answerData.elapsedMs || 0),
        ),
      }),
    },
    15000,
  );

  if (!response.ok) {
    const message = await readErrorBody(
      response,
      `تعذر إرسال الإجابة (${response.status}).`,
    );

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchGameEvents(
  configLike,
  roomId,
  token,
  after = 0,
) {
  const config = publicConfig(configLike);

  const url = new URL(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/events`,
    ),
  );

  url.searchParams.set(
    'after',
    String(Math.max(0, Number(after || 0))),
  );

  const response = await timeoutFetch(
    url.toString(),
    {
      method: 'GET',
      headers: gameHeaders(config, token),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر جلب أحداث اللعبة (${response.status}).`,
      ),
    );
  }

  return response.json();
}

export async function closeGameRoom(
  configLike,
  roomId,
  teacherToken,
) {
  const config = publicConfig(configLike);

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}`,
    ),
    {
      method: 'DELETE',
      headers: gameHeaders(config, teacherToken),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر إغلاق غرفة اللعب (${response.status}).`,
      ),
    );
  }

  return response.json();
}

export function createGamePoller({
  poll,
  onData,
  onError,
  intervalMs = DEFAULT_POLL_MS,
} = {}) {
  let stopped = false;
  let running = false;
  let timer = null;

  const schedule = () => {
    if (stopped) return;

    timer = setTimeout(
      tick,
      Math.max(700, Number(intervalMs || DEFAULT_POLL_MS)),
    );
  };

  const tick = async () => {
    if (stopped || running) return;

    running = true;

    try {
      const data = await poll?.();

      if (!stopped && data) {
        onData?.(data);
      }
    } catch (error) {
      if (!stopped) {
        onError?.(error);
      }
    } finally {
      running = false;
      schedule();
    }
  };

  tick();

  return {
    stop() {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },

    refresh() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      tick();
    },
  };
}


/* MOBDEA_POST_GAME_EVENT_SERVICE_V1 */

export async function postGameEvent(
  configLike,
  roomId,
  token,
  event = {},
) {
  const config = publicConfig(configLike);

  const type = safeTrim(event.type || '', 60);

  if (!type) {
    throw new Error('نوع حدث اللعبة مطلوب.');
  }

  const response = await timeoutFetch(
    buildCloudUrl(
      config.endpoint,
      `/game/rooms/${encodeURIComponent(roomId)}/events`,
    ),
    {
      method: 'POST',
      headers: gameHeaders(config, token),
      body: JSON.stringify({
        type,
        targetId: safeTrim(
          event.targetId || '',
          100,
        ),
        data:
          event.data &&
          typeof event.data === 'object' &&
          !Array.isArray(event.data)
            ? event.data
            : {},
      }),
    },
    15000,
  );

  if (!response.ok) {
    throw new Error(
      await readErrorBody(
        response,
        `تعذر إرسال حدث اللعبة (${response.status}).`,
      ),
    );
  }

  return response.json();
}
