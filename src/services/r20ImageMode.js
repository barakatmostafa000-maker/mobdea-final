export const R20_IMAGE_MODE_MARKER =
  "R20_FIX16_IMAGE_MODE_V1";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

const stateBySurface =
  new WeakMap();

const ROOT_SELECTORS = [
  '[data-r20-resource-kind="image"]',
  ".image-viewer",
  ".media-image",
  ".image-stage",
  ".image-preview",
  "[class*='image-viewer']",
  "[class*='image-stage']",
];

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function point(event) {
  return {
    x:
      event.clientX,
    y:
      event.clientY,
  };
}

function distance(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y,
  );
}

function midpoint(a, b) {
  return {
    x:
      (
        a.x +
        b.x
      ) / 2,
    y:
      (
        a.y +
        b.y
      ) / 2,
  };
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

function isUsableImage(img) {
  if (
    !img ||
    !img.currentSrc &&
    !img.src
  ) {
    return false;
  }

  if (
    img.closest(
      "button, [role='button'], nav, header, [class*='icon'], [class*='avatar']",
    )
  ) {
    return false;
  }

  const rect =
    img.getBoundingClientRect();

  return (
    rect.width >= 100 ||
    rect.height >= 100 ||
    img.naturalWidth >= 300 ||
    img.naturalHeight >= 300
  );
}

function findImageRoot() {
  for (
    const selector of
    ROOT_SELECTORS
  ) {
    for (
      const node of
      document.querySelectorAll(
        selector,
      )
    ) {
      const classRoot =
        classModeRoot(node);

      if (!classRoot) continue;

      const image =
        node.matches("img")
          ? node
          : [
              ...node.querySelectorAll(
                "img",
              ),
            ].find(
              isUsableImage,
            );

      if (image) {
        return {
          root:
            node,
          classRoot,
          image,
        };
      }
    }
  }

  const classRoot =
    document.querySelector(
      '[data-r20-classmode-root="true"]',
    );

  if (!classRoot) return null;

  const image =
    [
      ...classRoot.querySelectorAll(
        "img",
      ),
    ].find(
      isUsableImage,
    );

  if (!image) return null;

  const root =
    image.closest(
      ".image-viewer, .media-image, .image-stage, .image-preview, [data-r20-classmode-stage='true'], [data-r20-classmode-content='true']",
    ) ||
    image.parentElement;

  return {
    root,
    classRoot,
    image,
  };
}

function getState(surface) {
  let state =
    stateBySurface.get(
      surface,
    );

  if (!state) {
    state = {
      scale: 1,
      x: 0,
      y: 0,
      pointers:
        new Map(),
      pinchDistance: 0,
      pinchScale: 1,
      pinchMidpoint: null,
      pinchX: 0,
      pinchY: 0,
      panStart: null,
      panX: 0,
      panY: 0,
      imageSrc: "",
    };

    stateBySurface.set(
      surface,
      state,
    );
  }

  return state;
}

function clampPan(
  surface,
  image,
  state,
) {
  if (
    state.scale <= 1
  ) {
    state.x = 0;
    state.y = 0;
    return;
  }

  const surfaceRect =
    surface.getBoundingClientRect();

  const imageRect =
    image.getBoundingClientRect();

  const baseWidth =
    imageRect.width /
    Math.max(
      state.scale,
      .001,
    );

  const baseHeight =
    imageRect.height /
    Math.max(
      state.scale,
      .001,
    );

  const maxX =
    Math.max(
      0,
      (
        baseWidth *
        state.scale -
        surfaceRect.width
      ) / 2,
    );

  const maxY =
    Math.max(
      0,
      (
        baseHeight *
        state.scale -
        surfaceRect.height
      ) / 2,
    );

  state.x =
    clamp(
      state.x,
      -maxX,
      maxX,
    );

  state.y =
    clamp(
      state.y,
      -maxY,
      maxY,
    );
}

function render(
  surface,
  image,
  state,
) {
  clampPan(
    surface,
    image,
    state,
  );

  image.style.setProperty(
    "--r20-image-scale",
    String(
      state.scale,
    ),
  );

  image.style.setProperty(
    "--r20-image-pan-x",
    `${state.x}px`,
  );

  image.style.setProperty(
    "--r20-image-pan-y",
    `${state.y}px`,
  );

  surface.setAttribute(
    "data-r20-image-scale",
    state.scale.toFixed(
      3,
    ),
  );

  surface.setAttribute(
    "data-r20-image-pan-x",
    state.x.toFixed(
      1,
    ),
  );

  surface.setAttribute(
    "data-r20-image-pan-y",
    state.y.toFixed(
      1,
    ),
  );

  surface.setAttribute(
    "data-r20-image-zoomed",
    state.scale > 1.001
      ? "true"
      : "false",
  );
}

export function resetR20ImageTransform(
  surface,
  image,
) {
  const state =
    getState(surface);

  state.scale = 1;
  state.x = 0;
  state.y = 0;
  state.pointers.clear();
  state.pinchDistance = 0;
  state.panStart = null;

  render(
    surface,
    image,
    state,
  );
}

function beginPinch(
  surface,
  state,
) {
  const points =
    [
      ...state.pointers.values(),
    ];

  if (
    points.length < 2
  ) {
    return;
  }

  state.pinchDistance =
    Math.max(
      1,
      distance(
        points[0],
        points[1],
      ),
    );

  state.pinchScale =
    state.scale;

  state.pinchMidpoint =
    midpoint(
      points[0],
      points[1],
    );

  state.pinchX =
    state.x;

  state.pinchY =
    state.y;

  state.panStart =
    null;

  surface.setAttribute(
    "data-r20-image-pinching",
    "true",
  );
}

function updatePinch(
  surface,
  image,
  state,
) {
  const points =
    [
      ...state.pointers.values(),
    ];

  if (
    points.length < 2 ||
    !state.pinchDistance
  ) {
    return;
  }

  const nowDistance =
    Math.max(
      1,
      distance(
        points[0],
        points[1],
      ),
    );

  const currentMidpoint =
    midpoint(
      points[0],
      points[1],
    );

  const nextScale =
    clamp(
      state.pinchScale *
      (
        nowDistance /
        state.pinchDistance
      ),
      MIN_SCALE,
      MAX_SCALE,
    );

  const rect =
    surface.getBoundingClientRect();

  const startMidpoint =
    state.pinchMidpoint ||
    currentMidpoint;

  const focusX =
    startMidpoint.x -
    (
      rect.left +
      rect.width / 2
    );

  const focusY =
    startMidpoint.y -
    (
      rect.top +
      rect.height / 2
    );

  const ratio =
    nextScale /
    Math.max(
      state.pinchScale,
      .001,
    );

  state.scale =
    nextScale;

  state.x =
    state.pinchX +
    (
      currentMidpoint.x -
      startMidpoint.x
    ) -
    focusX *
    (
      ratio -
      1
    );

  state.y =
    state.pinchY +
    (
      currentMidpoint.y -
      startMidpoint.y
    ) -
    focusY *
    (
      ratio -
      1
    );

  render(
    surface,
    image,
    state,
  );
}

function beginPan(
  state,
  current,
) {
  state.panStart =
    current;

  state.panX =
    state.x;

  state.panY =
    state.y;
}

function updatePan(
  surface,
  image,
  state,
  current,
) {
  if (
    !state.panStart ||
    state.scale <= 1
  ) {
    return;
  }

  state.x =
    state.panX +
    (
      current.x -
      state.panStart.x
    );

  state.y =
    state.panY +
    (
      current.y -
      state.panStart.y
    );

  render(
    surface,
    image,
    state,
  );
}

function wire(
  surface,
  image,
) {
  const state =
    getState(surface);

  const currentSrc =
    image.currentSrc ||
    image.src ||
    "";

  if (
    state.imageSrc !==
    currentSrc
  ) {
    state.imageSrc =
      currentSrc;

    resetR20ImageTransform(
      surface,
      image,
    );
  }

  if (
    surface.dataset.r20ImageGesturesWired ===
    "true"
  ) {
    return;
  }

  surface.dataset.r20ImageGesturesWired =
    "true";

  surface.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.pointerType ===
          "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      state.pointers.set(
        event.pointerId,
        point(event),
      );

      try {
        surface.setPointerCapture(
          event.pointerId,
        );
      } catch {}

      if (
        state.pointers.size ===
        2
      ) {
        beginPinch(
          surface,
          state,
        );

        event.preventDefault();
      } else if (
        state.scale > 1
      ) {
        beginPan(
          state,
          point(event),
        );

        event.preventDefault();
      }
    },
    {
      passive: false,
    },
  );

  surface.addEventListener(
    "pointermove",
    (event) => {
      if (
        !state.pointers.has(
          event.pointerId,
        )
      ) {
        return;
      }

      state.pointers.set(
        event.pointerId,
        point(event),
      );

      if (
        state.pointers.size >=
        2
      ) {
        updatePinch(
          surface,
          image,
          state,
        );

        event.preventDefault();
        return;
      }

      if (
        state.scale > 1
      ) {
        updatePan(
          surface,
          image,
          state,
          point(event),
        );

        event.preventDefault();
      }
    },
    {
      passive: false,
    },
  );

  const endPointer =
    (event) => {
      state.pointers.delete(
        event.pointerId,
      );

      if (
        state.pointers.size < 2
      ) {
        surface.removeAttribute(
          "data-r20-image-pinching",
        );

        state.pinchDistance =
          0;

        state.pinchMidpoint =
          null;
      }

      if (
        state.pointers.size ===
          1 &&
        state.scale > 1
      ) {
        beginPan(
          state,
          [
            ...state.pointers.values(),
          ][0],
        );
      } else if (
        state.pointers.size ===
        0
      ) {
        state.panStart =
          null;
      }

      render(
        surface,
        image,
        state,
      );
    };

  surface.addEventListener(
    "pointerup",
    endPointer,
    {
      passive: true,
    },
  );

  surface.addEventListener(
    "pointercancel",
    endPointer,
    {
      passive: true,
    },
  );

  surface.addEventListener(
    "lostpointercapture",
    endPointer,
    {
      passive: true,
    },
  );

  surface.addEventListener(
    "wheel",
    (event) => {
      if (
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      event.preventDefault();

      const nextScale =
        clamp(
          state.scale *
          (
            event.deltaY < 0
              ? 1.12
              : .89
          ),
          MIN_SCALE,
          MAX_SCALE,
        );

      const rect =
        surface.getBoundingClientRect();

      const focusX =
        event.clientX -
        (
          rect.left +
          rect.width / 2
        );

      const focusY =
        event.clientY -
        (
          rect.top +
          rect.height / 2
        );

      const ratio =
        nextScale /
        Math.max(
          state.scale,
          .001,
        );

      state.x -=
        focusX *
        (
          ratio -
          1
        );

      state.y -=
        focusY *
        (
          ratio -
          1
        );

      state.scale =
        nextScale;

      render(
        surface,
        image,
        state,
      );
    },
    {
      passive: false,
    },
  );

  surface.addEventListener(
    "dblclick",
    (event) => {
      if (
        state.scale <= 1.001
      ) {
        return;
      }

      event.preventDefault();

      resetR20ImageTransform(
        surface,
        image,
      );
    },
    {
      passive: false,
    },
  );
}

function markImageMode() {
  const found =
    findImageRoot();

  if (!found) return;

  const {
    root,
    classRoot,
    image,
  } = found;

  root.setAttribute(
    "data-r20-image-surface",
    "true",
  );

  image.setAttribute(
    "data-r20-image-target",
    "true",
  );

  classRoot.setAttribute(
    "data-r20-classmode-image-active",
    "true",
  );

  wire(
    root,
    image,
  );

  render(
    root,
    image,
    getState(root),
  );
}

export function installR20ImageMode() {
  if (
    typeof window ===
      "undefined" ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_IMAGE_MODE__
  ) {
    return;
  }

  window.__MOBDEA_R20_IMAGE_MODE__ =
    R20_IMAGE_MODE_MARKER;

  window.mobdeaR20ImageMode =
    Object.freeze({
      marker:
        R20_IMAGE_MODE_MARKER,
      minScale:
        MIN_SCALE,
      maxScale:
        MAX_SCALE,
    });

  let queued =
    false;

  const schedule =
    () => {
      if (queued) return;

      queued = true;

      requestAnimationFrame(
        () => {
          queued = false;
          markImageMode();
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
        "style",
        "src",
        "data-r20-resource-kind",
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

  window.addEventListener(
    "orientationchange",
    schedule,
    {
      passive:
        true,
    },
  );

  runMicrotask(schedule);
}

function runMicrotask(callback) {
  Promise.resolve().then(
    callback,
  );
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
      installR20ImageMode,
      {
        once: true,
      },
    );
  } else {
    installR20ImageMode();
  }
}
