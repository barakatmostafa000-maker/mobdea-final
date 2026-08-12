import test from 'node:test';
import assert from 'node:assert/strict';
import worldCountries from '../src/data/world-countries.json' with { type: 'json' };
import {
  GEOGRAPHY_REGIONS,
  getCountryFeatureId,
  getRegionCountries,
  getRegionLayerItems,
} from '../src/data/geography.js';

test('the nine classroom map regions contain visible country geometry', () => {
  for (const region of ['egypt', 'arab', 'africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'australia', 'world']) {
    assert.ok(GEOGRAPHY_REGIONS[region]);
    const countries = getRegionCountries(worldCountries, region);
    assert.ok(countries.length > 0, `${region} must not be an empty map`);
    assert.ok(countries.every((feature) => feature.geometry?.coordinates?.length));
  }
});

test('the Arab map includes all 22 Arab states including Bahrain and Comoros', () => {
  const countries = getRegionCountries(worldCountries, 'arab');
  const ids = new Set(countries.map((feature, index) => getCountryFeatureId(feature, index)));
  assert.equal(ids.size, 22);
  assert.ok(ids.has('BHR'));
  assert.ok(ids.has('COM'));
});

test('country ids are unique even when source ISO codes are missing', () => {
  const countries = getRegionCountries(worldCountries, 'world');
  const ids = countries.map((feature, index) => getCountryFeatureId(feature, index));
  assert.equal(new Set(ids).size, ids.length);
});

test('physical map layers expose mountains, plateaus, plains and deserts', () => {
  for (const layer of ['mountains', 'plateaus', 'plains', 'deserts']) {
    assert.ok(getRegionLayerItems(worldCountries, 'africa', layer).length > 0, `${layer} must have visible items`);
  }
});

test('every required map exposes the complete teaching layer set', () => {
  const requiredLayers = ['countries', 'borders', 'capitals', 'cities', 'mountains', 'plateaus', 'plains', 'deserts', 'rivers', 'seas', 'latitude', 'longitude', 'directions', 'population'];
  for (const region of ['egypt', 'arab', 'africa', 'asia', 'europe', 'world']) {
    for (const layer of requiredLayers) {
      assert.ok(getRegionLayerItems(worldCountries, region, layer).length > 0, `${region}/${layer} must not be empty`);
    }
  }
});

test('oceans are a distinct teaching layer instead of being merged into seas', () => {
  const oceans = getRegionLayerItems(worldCountries, 'world', 'oceans');
  const seas = getRegionLayerItems(worldCountries, 'world', 'seas');
  assert.ok(oceans.length > 0);
  assert.ok(oceans.every((item) => item.name.includes('محيط')));
  assert.ok(seas.every((item) => !item.name.includes('محيط')));
});
