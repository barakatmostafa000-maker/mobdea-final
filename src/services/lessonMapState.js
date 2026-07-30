import { GEOGRAPHY_REGIONS, getGradeMapRecommendation } from '../data/geography.js';

export function normalizeMapRegionSnapshot(saved = {}) {
  return {
    labels: saved.labels !== false,
    selectedCountryId: String(saved.selectedCountryId || ''),
    selectedPlaceId: String(saved.selectedPlaceId || ''),
    zoom: Math.max(1, Math.min(2.5, Number(saved.zoom || 1))),
    placements: Array.isArray(saved.placements) ? saved.placements : [],
    strokes: Array.isArray(saved.strokes) ? saved.strokes : [],
  };
}

export function normalizeLessonMapState(saved = {}, grade = '') {
  const recommendation = getGradeMapRecommendation(grade);
  const regionKey = GEOGRAPHY_REGIONS[saved.regionKey] ? saved.regionKey : recommendation.defaultRegion;
  const regions = Object.fromEntries(
    Object.entries(saved.regions || {})
      .filter(([key]) => Boolean(GEOGRAPHY_REGIONS[key]))
      .map(([key, value]) => [key, normalizeMapRegionSnapshot(value)]),
  );
  if (!regions[regionKey]) regions[regionKey] = normalizeMapRegionSnapshot(saved);
  return { regionKey, regions, ...regions[regionKey] };
}

export function mergeLessonMapRegion(state = {}, regionKey, snapshot = {}) {
  if (!GEOGRAPHY_REGIONS[regionKey]) return normalizeLessonMapState(state);
  const normalizedState = normalizeLessonMapState(state);
  const normalizedSnapshot = normalizeMapRegionSnapshot(snapshot);
  return {
    regionKey,
    regions: { ...normalizedState.regions, [regionKey]: normalizedSnapshot },
    ...normalizedSnapshot,
  };
}
