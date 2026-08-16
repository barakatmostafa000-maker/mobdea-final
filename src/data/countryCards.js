export const COUNTRY_CARD_CATEGORIES = Object.freeze([
  { key: 'arab', label: 'الوطن العربي' },
  { key: 'africa', label: 'أفريقيا' },
  { key: 'europe-asia', label: 'أوروبا وآسيا' },
  { key: 'americas-australia', label: 'الأمريكتان وأستراليا' },
]);

const rawCards = [
  ['01', 'مصر', 'arab'],
  ['02', 'السعودية', 'arab'],
  ['03', 'الإمارات', 'arab'],
  ['04', 'العراق', 'arab'],
  ['05', 'السودان', 'arab'],
  ['06', 'الجزائر', 'arab'],
  ['07', 'المغرب', 'arab'],
  ['08', 'فلسطين', 'arab'],
  ['09', 'جنوب أفريقيا', 'africa'],
  ['10', 'نيجيريا', 'africa'],
  ['11', 'إثيوبيا', 'africa'],
  ['12', 'الكونغو الديمقراطية', 'africa'],
  ['13', 'الصين', 'europe-asia'],
  ['14', 'الهند', 'europe-asia'],
  ['15', 'اليابان', 'europe-asia'],
  ['16', 'كوريا الجنوبية', 'europe-asia'],
  ['17', 'إندونيسيا', 'europe-asia'],
  ['18', 'باكستان', 'europe-asia'],
  ['19', 'تركيا', 'europe-asia'],
  ['20', 'إيران', 'europe-asia'],
  ['21', 'روسيا', 'europe-asia'],
  ['22', 'بريطانيا', 'europe-asia'],
  ['23', 'فرنسا', 'europe-asia'],
  ['24', 'ألمانيا', 'europe-asia'],
  ['25', 'إيطاليا', 'europe-asia'],
  ['26', 'إسبانيا', 'europe-asia'],
  ['27', 'اليونان', 'europe-asia'],
  ['28', 'الولايات المتحدة', 'americas-australia'],
  ['29', 'كندا', 'americas-australia'],
  ['30', 'البرازيل', 'americas-australia'],
  ['31', 'الأرجنتين', 'americas-australia'],
  ['32', 'المكسيك', 'americas-australia'],
  ['33', 'تشيلي', 'americas-australia'],
  ['34', 'أستراليا', 'americas-australia'],
  ['35', 'نيوزيلندا', 'americas-australia'],
];

export const DEFAULT_COUNTRY_CARD = Object.freeze({
  key: '00',
  name: 'بطاقة دولة افتراضية',
  category: 'default',
  asset: '/whiteboard/country-cards/00.png',
  isDefault: true,
});

export const COUNTRY_CARDS = Object.freeze(rawCards.map(([key, name, category]) => ({
  key,
  name,
  category,
  asset: `/whiteboard/country-cards/${key}.png`,
  isDefault: false,
})));

export const COUNTRY_CARD_MAP = Object.freeze(Object.fromEntries(
  [DEFAULT_COUNTRY_CARD, ...COUNTRY_CARDS].map((item) => [item.key, item]),
));

export function countryCardsForCategory(category) {
  return COUNTRY_CARDS.filter((item) => item.category === category)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, 'ar'));
}
