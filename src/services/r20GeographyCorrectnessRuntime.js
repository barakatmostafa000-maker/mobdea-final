import {
  R20_ARAB_WORLD,
  R20_NILE_BASIN_COUNTRIES,
  canonicalCountryName,
  ensureArabWorldMembership,
  ensureNileBasinMembership,
  validateArabWorld,
  validateNileBasin,
} from "./r20GeographyTruth.js";

export const R20_GEOGRAPHY_RUNTIME_MARKER =
  "R20_FIX14_GEOGRAPHY_RUNTIME_V1";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function mapKind(root) {
  const text = clean([
    root.getAttribute?.("aria-label"),
    root.getAttribute?.("title"),
    root.getAttribute?.("data-map-type"),
    root.getAttribute?.("data-region"),
    root.className,
    root.parentElement?.textContent,
  ].filter(Boolean).join(" "));

  if (
    /arab world|الوطن العربي|العالم العربي|الدول العربية/.test(text)
  ) {
    return "arab-world";
  }

  if (
    /nile basin|حوض النيل|دول حوض النيل/.test(text)
  ) {
    return "nile-basin";
  }

  if (
    /egypt|مصر/.test(text)
  ) {
    return "egypt";
  }

  return null;
}

function countryCandidateValues(element) {
  return [
    element.getAttribute?.("data-country"),
    element.getAttribute?.("data-country-name"),
    element.getAttribute?.("data-name"),
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.textContent,
  ];
}

function collectNames(root) {
  const names = new Set();

  root.querySelectorAll(
    "[data-country], [data-country-name], [data-name], [aria-label], [title], svg text, .country-label",
  ).forEach((element) => {
    countryCandidateValues(element)
      .forEach((value) => {
        const canonical =
          canonicalCountryName(value);

        if (canonical) {
          names.add(canonical);
        }
      });
  });

  return [...names];
}

function revealRequiredCountries(root, countries) {
  const required =
    new Set(countries);

  root.querySelectorAll(
    "[data-country], [data-country-name], [data-name], [aria-label], [title], svg text, .country-label, svg path, svg polygon, svg g",
  ).forEach((element) => {
    for (const value of countryCandidateValues(element)) {
      const canonical =
        canonicalCountryName(value);

      if (
        !canonical ||
        !required.has(canonical)
      ) {
        continue;
      }

      element.setAttribute(
        "data-r20-geography-required-country",
        canonical,
      );

      element.hidden = false;

      if (
        element.getAttribute(
          "aria-hidden",
        ) === "true"
      ) {
        element.setAttribute(
          "aria-hidden",
          "false",
        );
      }

      if (
        element.style?.display ===
        "none"
      ) {
        element.style.removeProperty(
          "display",
        );
      }

      if (
        element.style?.visibility ===
        "hidden"
      ) {
        element.style.removeProperty(
          "visibility",
        );
      }

      break;
    }
  });
}

function auditRoot(root, kind) {
  const names =
    collectNames(root);

  if (
    kind ===
    "arab-world"
  ) {
    revealRequiredCountries(
      root,
      R20_ARAB_WORLD,
    );

    const result =
      validateArabWorld(names);

    root.setAttribute(
      "data-r20-arab-world-status",
      result.ok
        ? "complete"
        : "incomplete",
    );

    root.setAttribute(
      "data-r20-arab-world-missing",
      result.missing.join(","),
    );
  }

  if (
    kind ===
    "nile-basin"
  ) {
    revealRequiredCountries(
      root,
      R20_NILE_BASIN_COUNTRIES,
    );

    const result =
      validateNileBasin(names);

    root.setAttribute(
      "data-r20-nile-basin-status",
      result.ok
        ? "complete"
        : "incomplete",
    );

    root.setAttribute(
      "data-r20-nile-basin-missing",
      result.missing.join(","),
    );
  }

  root.setAttribute(
    "data-r20-geography-kind",
    kind,
  );
}

function repairInMemoryDataObject(value, keyHint = "") {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const hint =
      clean(keyHint);

    if (
      value.length > 0 &&
      value.every(
        (item) =>
          typeof item ===
          "string",
      )
    ) {
      if (
        /arab|عرب|الوطن العربي/.test(hint)
      ) {
        return ensureArabWorldMembership(value);
      }

      if (
        /nile|حوض النيل/.test(hint)
      ) {
        return ensureNileBasinMembership(value);
      }

      return value.map(
        canonicalCountryName,
      );
    }

    return value.map(
      (item) =>
        repairInMemoryDataObject(
          item,
          keyHint,
        ),
    );
  }

  for (const [key, child] of Object.entries(value)) {
    value[key] =
      repairInMemoryDataObject(
        child,
        `${keyHint} ${key}`,
      );
  }

  return value;
}

function roots() {
  return [
    ...document.querySelectorAll(
      "[data-r20-map-root='true'], [data-r20-atlas-root='true'], [data-map-stage], .map-stage, .map-viewer, [class*='geography-map']",
    ),
  ];
}

function run() {
  roots().forEach((root) => {
    const kind =
      mapKind(root);

    if (kind) {
      auditRoot(
        root,
        kind,
      );
    }
  });
}

export function installR20GeographyCorrectnessRuntime() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  if (
    window.__MOBDEA_R20_GEOGRAPHY_RUNTIME__
  ) {
    return;
  }

  window.__MOBDEA_R20_GEOGRAPHY_RUNTIME__ =
    R20_GEOGRAPHY_RUNTIME_MARKER;

  window.mobdeaR20RepairGeographyData =
    repairInMemoryDataObject;

  let queued = false;

  const schedule = () => {
    if (queued) return;

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  };

  new MutationObserver(schedule).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "data-country",
        "data-country-name",
        "data-name",
        "aria-label",
        "title",
      ],
    },
  );

  run();
}

if (typeof window !== "undefined") {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      installR20GeographyCorrectnessRuntime,
      { once: true },
    );
  } else {
    installR20GeographyCorrectnessRuntime();
  }
}
