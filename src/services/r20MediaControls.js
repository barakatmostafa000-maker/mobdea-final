import {
  R20_MEDIA_CAPABILITIES,
} from "../config/r20MediaCapabilities.js";

export const R20_MEDIA_CONTROLS_MARKER =
  "R20_FIX17_MEDIA_CONTROLS_V1";

const stateByMedia =
  new WeakMap();

function formatTime(value) {
  const seconds =
    Number.isFinite(value) &&
    value > 0
      ? Math.floor(value)
      : 0;

  const minutes =
    Math.floor(
      seconds / 60,
    );

  const remainder =
    String(
      seconds % 60,
    ).padStart(
      2,
      "0",
    );

  return `${minutes}:${remainder}`;
}

function classModeRoot(element) {
  return (
    element.closest(
      '[data-r20-classmode-root="true"]',
    ) ||
    element.closest(
      ".classmode-v103, .classmode-page, .lesson-mode-shell",
    )
  );
}

function surfaceFor(media) {
  const classRoot =
    classModeRoot(media);

  if (!classRoot) return null;

  const surface =
    media.closest(
      ".video-viewer, .audio-viewer, .media-viewer, .media-stage, [data-media-viewer], [data-r20-classmode-stage='true'], [data-r20-classmode-content='true']",
    ) ||
    media.parentElement;

  if (
    !surface ||
    surface === media
  ) {
    return media.parentElement;
  }

  return surface;
}

function stateFor(media) {
  let state =
    stateByMedia.get(
      media,
    );

  if (!state) {
    state = {
      controls: null,
      play: null,
      seek: null,
      time: null,
      mute: null,
      volume: null,
      fullscreen: null,
    };

    stateByMedia.set(
      media,
      state,
    );
  }

  return state;
}

function button(
  action,
  label,
  text,
) {
  const node =
    document.createElement(
      "button",
    );

  node.type =
    "button";

  node.className =
    "r20-media-control-button";

  node.setAttribute(
    "data-r20-media-action",
    action,
  );

  node.setAttribute(
    "aria-label",
    label,
  );

  node.setAttribute(
    "title",
    label,
  );

  node.textContent =
    text;

  return node;
}

function buildControls(
  surface,
  media,
  kind,
) {
  const state =
    stateFor(media);

  if (
    state.controls &&
    state.controls.isConnected
  ) {
    return state;
  }

  const controls =
    document.createElement(
      "div",
    );

  controls.className =
    "r20-media-controls";

  controls.setAttribute(
    "data-r20-media-controls",
    kind,
  );

  const play =
    button(
      "play",
      "تشغيل أو إيقاف مؤقت",
      "▶",
    );

  const back =
    button(
      "back-10",
      "رجوع 10 ثوانٍ",
      "−10",
    );

  const forward =
    button(
      "forward-10",
      "تقديم 10 ثوانٍ",
      "+10",
    );

  const seek =
    document.createElement(
      "input",
    );

  seek.type =
    "range";

  seek.min =
    "0";

  seek.max =
    "1000";

  seek.step =
    "1";

  seek.value =
    "0";

  seek.className =
    "r20-media-seek";

  seek.setAttribute(
    "data-r20-media-action",
    "seek",
  );

  seek.setAttribute(
    "aria-label",
    "موضع التشغيل",
  );

  const time =
    document.createElement(
      "span",
    );

  time.className =
    "r20-media-time";

  time.setAttribute(
    "data-r20-media-time",
    "true",
  );

  time.textContent =
    "0:00 / 0:00";

  const mute =
    button(
      "mute",
      "كتم أو تشغيل الصوت",
      "🔊",
    );

  const volume =
    document.createElement(
      "input",
    );

  volume.type =
    "range";

  volume.min =
    "0";

  volume.max =
    "1";

  volume.step =
    "0.05";

  volume.value =
    String(
      Number.isFinite(
        media.volume,
      )
        ? media.volume
        : 1,
    );

  volume.className =
    "r20-media-volume";

  volume.setAttribute(
    "data-r20-media-action",
    "volume",
  );

  volume.setAttribute(
    "aria-label",
    "مستوى الصوت",
  );

  controls.append(
    play,
    back,
    forward,
    seek,
    time,
    mute,
    volume,
  );

  let fullscreen =
    null;

  if (
    kind ===
    "video"
  ) {
    fullscreen =
      button(
        "fullscreen",
        "ملء الشاشة",
        "⛶",
      );

    controls.appendChild(
      fullscreen,
    );
  }

  surface.appendChild(
    controls,
  );

  state.controls =
    controls;

  state.play =
    play;

  state.seek =
    seek;

  state.time =
    time;

  state.mute =
    mute;

  state.volume =
    volume;

  state.fullscreen =
    fullscreen;

  controls.addEventListener(
    "pointerdown",
    (event) => {
      event.stopPropagation();
    },
    true,
  );

  controls.addEventListener(
    "click",
    async (event) => {
      const control =
        event.target.closest?.(
          "[data-r20-media-action]",
        );

      if (!control) return;

      const action =
        control.getAttribute(
          "data-r20-media-action",
        );

      if (
        action ===
        "play"
      ) {
        event.preventDefault();

        if (
          media.paused ||
          media.ended
        ) {
          try {
            await media.play();
          } catch {}
        } else {
          media.pause();
        }
      }

      if (
        action ===
        "back-10"
      ) {
        event.preventDefault();

        media.currentTime =
          Math.max(
            0,
            media.currentTime -
            10,
          );
      }

      if (
        action ===
        "forward-10"
      ) {
        event.preventDefault();

        const duration =
          Number.isFinite(
            media.duration,
          )
            ? media.duration
            : media.currentTime +
              10;

        media.currentTime =
          Math.min(
            duration,
            media.currentTime +
            10,
          );
      }

      if (
        action ===
        "mute"
      ) {
        event.preventDefault();

        media.muted =
          !media.muted;
      }

      if (
        action ===
        "fullscreen"
      ) {
        event.preventDefault();

        const target =
          surface;

        if (
          document.fullscreenElement
        ) {
          try {
            await document.exitFullscreen();
          } catch {}
        } else if (
          target.requestFullscreen
        ) {
          try {
            await target.requestFullscreen();
          } catch {}
        }
      }
    },
  );

  seek.addEventListener(
    "input",
    () => {
      const duration =
        media.duration;

      if (
        !Number.isFinite(
          duration,
        ) ||
        duration <= 0
      ) {
        return;
      }

      media.currentTime =
        duration *
        (
          Number(
            seek.value,
          ) /
          1000
        );
    },
  );

  volume.addEventListener(
    "input",
    () => {
      media.volume =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              volume.value,
            ),
          ),
        );

      if (
        media.volume > 0
      ) {
        media.muted =
          false;
      }
    },
  );

  return state;
}

function updateControls(
  media,
  state,
) {
  if (
    !state.controls ||
    !state.controls.isConnected
  ) {
    return;
  }

  const duration =
    Number.isFinite(
      media.duration,
    )
      ? media.duration
      : 0;

  const current =
    Number.isFinite(
      media.currentTime,
    )
      ? media.currentTime
      : 0;

  state.play.textContent =
    media.paused
      ? "▶"
      : "❚❚";

  state.mute.textContent =
    media.muted ||
    media.volume === 0
      ? "🔇"
      : "🔊";

  state.time.textContent =
    `${formatTime(current)} / ${formatTime(duration)}`;

  if (
    duration > 0
  ) {
    state.seek.value =
      String(
        Math.round(
          current /
          duration *
          1000,
        ),
      );
  } else {
    state.seek.value =
      "0";
  }

  state.volume.value =
    String(
      media.muted
        ? 0
        : media.volume,
    );

  state.seek.disabled =
    !(duration > 0);
}

function wireMedia(
  media,
  kind,
) {
  if (
    kind ===
      "video" &&
    !R20_MEDIA_CAPABILITIES.video
  ) {
    return;
  }

  if (
    kind ===
      "audio" &&
    !R20_MEDIA_CAPABILITIES.audio
  ) {
    return;
  }

  const surface =
    surfaceFor(media);

  if (!surface) return;

  surface.setAttribute(
    "data-r20-media-surface",
    kind,
  );

  media.setAttribute(
    "data-r20-media-target",
    kind,
  );

  media.setAttribute(
    "playsinline",
    "",
  );

  const state =
    buildControls(
      surface,
      media,
      kind,
    );

  if (
    media.dataset.r20MediaWired !==
    "true"
  ) {
    media.dataset.r20MediaWired =
      "true";

    for (
      const eventName of [
        "loadedmetadata",
        "durationchange",
        "timeupdate",
        "play",
        "pause",
        "ended",
        "volumechange",
        "emptied",
      ]
    ) {
      media.addEventListener(
        eventName,
        () => {
          updateControls(
            media,
            state,
          );
        },
      );
    }
  }

  
  // Custom controls are fully wired before native controls are hidden.
  // If controls cannot be built, the original native controls remain.
  if (
    state.controls &&
    state.controls.isConnected
  ) {
    media.controls =
      false;
  } else {
    media.controls =
      true;
  }


  updateControls(
    media,
    state,
  );
}

function run() {
  document.querySelectorAll(
    "video",
  ).forEach((media) => {
    if (
      classModeRoot(media)
    ) {
      wireMedia(
        media,
        "video",
      );
    }
  });

  document.querySelectorAll(
    "audio",
  ).forEach((media) => {
    if (
      classModeRoot(media)
    ) {
      wireMedia(
        media,
        "audio",
      );
    }
  });
}

export function installR20MediaControls() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_MEDIA_CONTROLS__
  ) {
    return;
  }

  window.__MOBDEA_R20_MEDIA_CONTROLS__ =
    R20_MEDIA_CONTROLS_MARKER;

  let queued =
    false;

  const schedule =
    () => {
      if (queued) return;

      queued = true;

      requestAnimationFrame(
        () => {
          queued = false;
          run();
        },
      );
    };

  new MutationObserver(
    schedule,
  ).observe(
    document.documentElement,
    {
      childList:
        true,
      subtree:
        true,
      attributes:
        true,
      attributeFilter: [
        "class",
        "src",
        "controls",
      ],
    },
  );

  window.addEventListener(
    "resize",
    schedule,
    {
      passive:
        true,
    },
  );

  run();
}

if (
  typeof window !==
  "undefined"
) {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20MediaControls,
      {
        once: true,
      },
    );
  } else {
    installR20MediaControls();
  }
}
