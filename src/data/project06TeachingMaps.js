// PROJECT06_PROFESSIONAL_TEACHING_MAPS_V1

export const REFERENCE_LATITUDES = Object.freeze([
  { id: 'equator', value: 0, label: 'خط الاستواء 0°', major: true },
  { id: 'cancer', value: 23.5, label: 'مدار السرطان 23.5°ش', major: true },
  { id: 'capricorn', value: -23.5, label: 'مدار الجدي 23.5°ج', major: true },
  { id: 'arctic', value: 66.5, label: 'الدائرة القطبية الشمالية 66.5°ش', major: false },
  { id: 'antarctic', value: -66.5, label: 'الدائرة القطبية الجنوبية 66.5°ج', major: false },
]);

export const REFERENCE_LONGITUDES = Object.freeze([
  { id: 'greenwich', value: 0, label: 'خط جرينتش 0°', prime: true },
  { id: 'lon30e', value: 30, label: '30° شرقًا', prime: false },
  { id: 'lon60e', value: 60, label: '60° شرقًا', prime: false },
  { id: 'lon30w', value: -30, label: '30° غربًا', prime: false },
  { id: 'lon60w', value: -60, label: '60° غربًا', prime: false },
]);

const nileMain = [
  [32.56, 15.50], [32.74, 16.7], [33.02, 17.7], [32.72, 19.0],
  [32.35, 20.3], [32.90, 22.0], [32.93, 23.3], [32.89, 24.1],
  [32.64, 25.7], [32.35, 26.9], [31.72, 28.1], [31.30, 29.2],
  [31.2357, 30.0444], [31.12, 30.70],
];

const nileDeltaWest = [
  [31.12, 30.70], [30.90, 30.95], [30.65, 31.12], [30.37, 31.25], [30.05, 31.31],
];

const nileDeltaEast = [
  [31.12, 30.70], [31.40, 30.95], [31.65, 31.10], [31.90, 31.22], [32.22, 31.31],
];

export const TEACHING_RIVER_PATHS = Object.freeze({
  egypt: [
    { id: 'nile-egypt', name: 'نهر النيل', kind: 'main', coords: nileMain.slice(6), labelCoord: [31.55, 27.7] },
    { id: 'delta-west-egypt', name: 'فرع رشيد', kind: 'delta', coords: nileDeltaWest, labelCoord: [30.55, 31.08] },
    { id: 'delta-east-egypt', name: 'فرع دمياط', kind: 'delta', coords: nileDeltaEast, labelCoord: [31.72, 31.10] },
  ],
  arab: [
    { id: 'nile-arab', name: 'نهر النيل', kind: 'main', coords: [[32.6,15.5],[33,18],[32.9,22],[32.9,24],[32.4,27],[31.24,30.04],[31.12,30.7]], labelCoord: [32.4, 24.8] },
    { id: 'tigris', name: 'دجلة', kind: 'river', coords: [[43.2,37.3],[43.8,35.5],[44.3,33.3],[45.2,31.0],[47.0,30.5]], labelCoord: [44.1, 34.0] },
    { id: 'euphrates', name: 'الفرات', kind: 'river', coords: [[38.2,37.0],[39.7,35.5],[41.1,34.0],[42.5,32.8],[44.5,31.6],[47.2,30.6]], labelCoord: [41.1, 34.5] },
  ],
  africa: [
    { id: 'nile-africa', name: 'النيل', kind: 'main', coords: [[33.0,-1.0],[32.2,3.0],[31.6,6.0],[32.2,10.0],[32.56,15.5],[33.0,18.0],[32.9,22.0],[32.4,27.0],[31.24,30.04],[31.1,31.0]], labelCoord: [32.0, 18.0] },
    { id: 'congo-africa', name: 'الكونغو', kind: 'river', coords: [[29.2,-4.0],[27.0,-2.0],[24.0,-1.0],[21.0,-1.0],[18.5,-3.0],[15.8,-5.8],[13.2,-6.0]], labelCoord: [21.0, -1.7] },
    { id: 'niger-africa', name: 'النيجر', kind: 'river', coords: [[-10.5,9.5],[-7.0,11.0],[-3.0,14.0],[1.0,14.0],[3.0,12.0],[4.5,9.5],[6.0,7.0]], labelCoord: [0.5, 13.6] },
    { id: 'zambezi-africa', name: 'الزمبيزي', kind: 'river', coords: [[23.0,-12.0],[25.5,-15.0],[28.0,-17.8],[31.0,-18.0],[34.0,-17.0],[36.0,-18.5]], labelCoord: [29.0, -17.5] },
    { id: 'orange-africa', name: 'الأورانج', kind: 'river', coords: [[29.0,-29.0],[25.0,-29.3],[21.0,-29.0],[17.0,-28.6]], labelCoord: [23.0, -29.2] },
  ],
  nile: [
    { id: 'kagera', name: 'نهر كاجيرا', kind: 'tributary', coords: [[29.7,-2.5],[30.3,-2.1],[30.8,-1.7],[31.3,-1.35],[31.8,-1.05],[32.1,-1.0]], labelCoord: [30.8,-1.75] },
    { id: 'victoria-nile', name: 'نهر فيكتوريا', kind: 'white', coords: [[33.0,-1.0],[33.19,0.44],[33.05,1.0],[33.0,1.5],[32.45,1.8],[31.85,2.2],[30.9,1.7]], labelCoord: [32.7,1.3] },
    { id: 'bahr-jabal', name: 'بحر الجبل', kind: 'white', coords: [[30.9,1.7],[31.3,2.7],[31.58,4.86],[31.55,6.2],[31.45,7.6],[31.6,8.6]], labelCoord: [31.45,5.8] },
    { id: 'bahr-ghazal', name: 'بحر الغزال', kind: 'tributary', coords: [[25.8,7.8],[27.2,8.1],[28.3,8.5],[29.3,8.8],[30.3,9.1],[31.0,9.2]], labelCoord: [28.4,8.45] },
    { id: 'bahr-arab', name: 'بحر العرب', kind: 'tributary', coords: [[24.8,9.4],[26.2,9.5],[27.6,9.4],[28.8,9.2],[30.0,9.0]], labelCoord: [27.4,9.55] },
    { id: 'sobat', name: 'نهر السوباط', kind: 'tributary', coords: [[34.6,8.3],[33.8,8.4],[33.0,8.7],[32.4,9.1],[31.65,9.55]], labelCoord: [33.0,8.8] },
    { id: 'white-nile', name: 'النيل الأبيض', kind: 'white', coords: [[31.6,8.6],[31.65,9.55],[31.8,10.8],[32.1,12.4],[32.35,14.0],[32.49,15.23],[32.56,15.50]], labelCoord: [32.0,12.0] },
    { id: 'blue-nile', name: 'النيل الأزرق', kind: 'blue', coords: [[37.30,12.0],[36.5,11.4],[35.2,10.8],[34.3,11.8],[33.62,13.55],[33.1,14.5],[32.56,15.50]], labelCoord: [35.2,12.0] },
    { id: 'atbara', name: 'نهر عطبرة', kind: 'tributary', coords: [[37.7,13.7],[36.7,15.0],[35.5,16.3],[34.5,17.2],[33.98,17.70]], labelCoord: [35.7,16.0] },
    { id: 'main-nile', name: 'النيل الرئيسي', kind: 'main', coords: nileMain, labelCoord: [32.30,23.0] },
    { id: 'delta-west', name: 'فرع رشيد', kind: 'delta', coords: nileDeltaWest, labelCoord: [30.52,31.08] },
    { id: 'delta-east', name: 'فرع دمياط', kind: 'delta', coords: nileDeltaEast, labelCoord: [31.78,31.08] },
  ],
});

export const NILE_LANDMARKS = Object.freeze([
  { id: 'victoria', name: 'بحيرة فيكتوريا', coord: [33.0, -1.0], kind: 'source' },
  { id: 'edward', name: 'بحيرة إدوارد', coord: [29.60, -0.33], kind: 'lake' },
  { id: 'kyoga', name: 'بحيرة كيوجا', coord: [33.0, 1.5], kind: 'lake' },
  { id: 'albert', name: 'بحيرة ألبرت', coord: [30.9, 1.7], kind: 'lake' },
  { id: 'owen', name: 'سد أوين', coord: [33.19, 0.44], kind: 'dam' },
  { id: 'jebel-aulia', name: 'خزان جبل الأولياء', coord: [32.49, 15.23], kind: 'dam' },
  { id: 'sennar', name: 'خزان سنار', coord: [33.62, 13.55], kind: 'dam' },
  { id: 'tana', name: 'بحيرة تانا', coord: [37.30, 12.0], kind: 'source' },
  { id: 'khartoum', name: 'ملتقى النيلين — الخرطوم', coord: [32.56, 15.50], kind: 'confluence' },
  { id: 'atbara-city', name: 'عطبرة', coord: [33.98, 17.70], kind: 'confluence' },
  { id: 'aswan', name: 'السد العالي — أسوان', coord: [32.90, 24.09], kind: 'dam' },
  { id: 'cairo', name: 'القاهرة', coord: [31.2357, 30.0444], kind: 'city' },
  { id: 'delta', name: 'دلتا النيل', coord: [31.12, 30.95], kind: 'delta' },
]);

export function getTeachingRiverPaths(regionKey) {
  return TEACHING_RIVER_PATHS[regionKey] || [];
}
