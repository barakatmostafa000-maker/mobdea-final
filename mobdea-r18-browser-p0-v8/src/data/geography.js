const arabIso = ['DZA', 'BHR', 'COM', 'DJI', 'EGY', 'IRQ', 'JOR', 'KWT', 'LBN', 'LBY', 'MRT', 'MAR', 'OMN', 'PSE', 'QAT', 'SAU', 'SOM', 'SDN', 'SYR', 'TUN', 'ARE', 'YEM'];

// Natural Earth 110m omits a few small island states. These compact, real-world
// coordinate outlines keep the Arab-region map complete without drawing an
// empty placeholder for Bahrain or Comoros.
const supplementalCountries = Object.freeze([
  {
    type: 'Feature',
    properties: { iso_a3: 'BHR', name: 'Bahrain', continent: 'Asia' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[50.45, 26.28], [50.49, 26.06], [50.57, 25.80], [50.66, 25.73], [50.67, 25.96], [50.62, 26.24], [50.45, 26.28]]],
    },
  },
  {
    type: 'Feature',
    properties: { iso_a3: 'COM', name: 'Comoros', continent: 'Africa' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[[43.22, -11.42], [43.24, -11.93], [43.36, -11.94], [43.42, -11.55], [43.22, -11.42]]],
        [[[43.63, -12.06], [43.64, -12.38], [43.82, -12.42], [43.87, -12.12], [43.63, -12.06]]],
        [[[44.19, -12.07], [44.22, -12.37], [44.48, -12.42], [44.53, -12.10], [44.19, -12.07]]],
      ],
    },
  },
]);

const countryNameOverrides = {
  PSE: 'فلسطين', ESH: 'الصحراء الغربية', COD: 'الكونغو الديمقراطية', COG: 'الكونغو',
  USA: 'الولايات المتحدة', GBR: 'المملكة المتحدة', RUS: 'روسيا', KOR: 'كوريا الجنوبية', PRK: 'كوريا الشمالية',
  CZE: 'التشيك', MKD: 'مقدونيا الشمالية', LAO: 'لاوس', VNM: 'فيتنام', BOL: 'بوليفيا', VEN: 'فنزويلا',
};

let arabicRegionNames;
try {
  arabicRegionNames = new Intl.DisplayNames(['ar'], { type: 'region' });
} catch {
  arabicRegionNames = null;
}

export function getCountryName(featureOrIso, fallback = '') {
  const iso = typeof featureOrIso === 'string' ? featureOrIso : featureOrIso?.properties?.iso_a3;
  const name = typeof featureOrIso === 'string' ? fallback : featureOrIso?.properties?.name;
  if (countryNameOverrides[iso]) return countryNameOverrides[iso];
  try {
    return arabicRegionNames?.of(iso) || name || iso || 'موقع غير مسمى';
  } catch {
    return name || iso || 'موقع غير مسمى';
  }
}

export const GEOGRAPHY_REGIONS = Object.freeze({
  egypt: {
    title: 'مصر', subtitle: 'مصر والظواهر الطبيعية والبشرية', bounds: [24, 22, 37, 32.5],
    countryFilter: (feature) => feature.properties.iso_a3 === 'EGY',
  },
  arab: {
    title: 'الوطن العربي', subtitle: 'الدول العربية ومظاهر السطح والثروات', bounds: [-18, 8, 61, 39],
    countryFilter: (feature) => arabIso.includes(feature.properties.iso_a3),
  },
  africa: {
    title: 'إفريقيا', subtitle: 'الدول والأنهار والتضاريس والثروات', bounds: [-19, -36, 53, 38],
    countryFilter: (feature) => feature.properties.continent === 'Africa',
  },
  asia: {
    title: 'آسيا', subtitle: 'دول آسيا والتضاريس والأنهار والموارد', bounds: [25, -12, 180, 82],
    countryFilter: (feature) => feature.properties.continent === 'Asia',
  },
  europe: {
    title: 'أوروبا', subtitle: 'دول أوروبا والجبال والأنهار والمدن', bounds: [-25, 34, 50, 72],
    countryFilter: (feature) => feature.properties.continent === 'Europe',
  },
  northAmerica: {
    title: 'أمريكا الشمالية', subtitle: 'الدول والتضاريس والبحيرات والثروات', bounds: [-170, 5, -50, 85],
    countryFilter: (feature) => feature.properties.continent === 'North America',
  },
  southAmerica: {
    title: 'أمريكا الجنوبية', subtitle: 'الدول والأنديز والأمازون والموارد', bounds: [-85, -58, -30, 15],
    countryFilter: (feature) => feature.properties.continent === 'South America',
  },
  australia: {
    title: 'أستراليا وأوقيانوسيا', subtitle: 'أستراليا والجزر والمظاهر الطبيعية', bounds: [105, -50, 180, 5],
    countryFilter: (feature) => feature.properties.continent === 'Oceania',
  },
  world: {
    title: 'العالم', subtitle: 'قارات ودول العالم', bounds: [-180, -60, 180, 85],
    countryFilter: (feature) => !['Antarctica', 'Seven seas (open ocean)'].includes(feature.properties.continent),
  },
});

export const GEOGRAPHY_LAYERS = Object.freeze({
  countries: { title: 'الدول', color: '#d6ae38' },
  borders: { title: 'الحدود', color: '#f0d478' },
  capitals: { title: 'العواصم', color: '#d64545' },
  cities: { title: 'المدن', color: '#f28c62' },
  mountains: { title: 'الجبال', color: '#9a704c' },
  plateaus: { title: 'الهضاب', color: '#bc8754' },
  plains: { title: 'السهول', color: '#6f9d63' },
  deserts: { title: 'الصحارى', color: '#d6ae38' },
  rivers: { title: 'الأنهار', color: '#2f80ed' },
  seas: { title: 'البحار', color: '#38a9db' },
  oceans: { title: 'المحيطات', color: '#1f78b4' },
  minerals: { title: 'الثروات', color: '#b85c9e' },
  terrain: { title: 'كل التضاريس', color: '#a87845' },
  water: { title: 'كل المياه', color: '#2f80ed' },
  latitude: { title: 'دوائر العرض', color: '#79c8e8' },
  longitude: { title: 'خطوط الطول', color: '#98d8ee' },
  directions: { title: 'الاتجاهات', color: '#f0d478' },
  population: { title: 'السكان', color: '#e2b24a' },
});

export const GEOGRAPHY_FEATURES = Object.freeze({
  egypt: {
    terrain: [['جبال البحر الأحمر', 33.2, 27.3], ['هضبة الجلف الكبير', 25.6, 23.5], ['جبل سانت كاترين', 33.95, 28.53], ['منخفض القطارة', 28.7, 30.0], ['دلتا النيل', 31.1, 31.0], ['سهل وادي النيل', 31.1, 26.5], ['الصحراء الغربية', 27.5, 26.5], ['الصحراء الشرقية', 33.2, 25.4]],
    water: [['نهر النيل', 31.1, 27.5], ['البحر الأحمر', 35.1, 26.5], ['البحر المتوسط', 30.5, 31.8], ['بحيرة ناصر', 32.7, 23.8], ['قناة السويس', 32.4, 30.3]],
    minerals: [['بترول خليج السويس', 33.1, 29.2], ['فوسفات أبو طرطور', 25.5, 25.4], ['حديد الواحات البحرية', 28.9, 28.3], ['ذهب السكري', 34.7, 24.95], ['غاز البحر المتوسط', 31.8, 31.8]],
    capitals: [['القاهرة', 31.2357, 30.0444], ['الإسكندرية', 29.9187, 31.2001], ['أسوان', 32.8998, 24.0889], ['الأقصر', 32.6396, 25.6872], ['بورسعيد', 32.3019, 31.2653], ['السويس', 32.55, 29.97]],
  },
  arab: {
    terrain: [['جبال أطلس', -5, 32], ['جبال الحجاز', 39.5, 23.5], ['هضبة نجد', 45, 24], ['جبال لبنان', 35.8, 33.9], ['مرتفعات اليمن', 44, 15.5], ['الصحراء الكبرى', 12, 25], ['سهول دجلة والفرات', 44, 32]],
    water: [['نهر النيل', 31, 22], ['دجلة والفرات', 44, 33], ['البحر الأحمر', 38, 22], ['الخليج العربي', 51, 26], ['البحر المتوسط', 18, 35], ['المحيط الأطلسي', -13, 25]],
    minerals: [['بترول الخليج العربي', 49, 25], ['حديد موريتانيا', -11, 22], ['فوسفات المغرب', -7, 32], ['ذهب السودان', 33, 18], ['غاز الجزائر', 3, 29]],
    capitals: [['القاهرة', 31.2, 30.0], ['الرياض', 46.7, 24.7], ['بغداد', 44.4, 33.3], ['الرباط', -6.8, 34.0], ['الخرطوم', 32.6, 15.5], ['دمشق', 36.3, 33.5]],
  },
  africa: {
    terrain: [['جبال أطلس', -5, 32], ['هضبة الحبشة', 39, 9], ['جبال دراكنزبرج', 29, -29], ['حوض الكونغو', 23, -3], ['الصحراء الكبرى', 12, 23], ['الأخدود الإفريقي العظيم', 36, -5]],
    water: [['نهر النيل', 31, 15], ['نهر الكونغو', 22, -2], ['نهر النيجر', 4, 10], ['بحيرة فيكتوريا', 33, -1], ['المحيط الهندي', 50, -10], ['نهر الزمبيزي', 28, -17]],
    minerals: [['ذهب جنوب إفريقيا', 27, -27], ['نحاس زامبيا', 28, -13], ['بترول نيجيريا', 6, 5], ['ماس الكونغو', 23, -5], ['فوسفات المغرب', -7, 32]],
    capitals: [['القاهرة', 31.2, 30], ['أديس أبابا', 38.7, 9], ['أبوجا', 7.5, 9.1], ['بريتوريا', 28.2, -25.7], ['نيروبي', 36.8, -1.3], ['الجزائر', 3.06, 36.75]],
  },
  asia: {
    terrain: [['جبال الهيمالايا', 86, 28], ['هضبة التبت', 88, 32], ['هضبة الدكن', 77, 17], ['جبال زاجروس', 47, 32], ['صحراء جوبي', 104, 43], ['سهول سيبيريا الغربية', 72, 58]],
    water: [['نهر اليانجتسي', 111, 30], ['نهر الجانج', 85, 25], ['نهر السند', 70, 27], ['بحر قزوين', 51, 42], ['بحيرة بايكال', 108, 53], ['المحيط الهادئ', 150, 20]],
    minerals: [['بترول الخليج العربي', 49, 25], ['فحم الصين', 112, 36], ['حديد الهند', 85, 22], ['قصدير ماليزيا', 102, 4], ['غاز سيبيريا', 85, 62]],
    capitals: [['بكين', 116.4, 39.9], ['طوكيو', 139.7, 35.7], ['نيودلهي', 77.2, 28.6], ['الرياض', 46.7, 24.7], ['جاكرتا', 106.8, -6.2], ['أنقرة', 32.85, 39.93]],
  },
  europe: {
    terrain: [['جبال الألب', 10, 46], ['جبال البرانس', 0, 42.6], ['جبال الكاربات', 25, 47], ['السهل الأوروبي العظيم', 20, 52], ['هضبة إسبانيا', -4, 40], ['جبال الأبنين', 13, 42], ['صحراء تابيرناس', -2.45, 37.0]],
    water: [['نهر الراين', 7, 50], ['نهر الدانوب', 20, 46], ['نهر الفولجا', 46, 48], ['البحر المتوسط', 18, 36], ['بحر الشمال', 3, 56], ['بحر البلطيق', 19, 58]],
    minerals: [['فحم الرور', 7, 51], ['حديد السويد', 18, 67], ['بترول بحر الشمال', 2, 59], ['غاز هولندا', 6, 53], ['بوكسيت فرنسا', 4, 44]],
    capitals: [['لندن', -0.13, 51.5], ['باريس', 2.35, 48.85], ['برلين', 13.4, 52.5], ['روما', 12.5, 41.9], ['مدريد', -3.7, 40.4], ['موسكو', 37.6, 55.75]],
  },
  northAmerica: {
    terrain: [['جبال الروكي', -112, 45], ['جبال الأبلاش', -80, 38], ['السهول العظمى', -101, 42], ['هضبة المكسيك', -102, 23], ['منخفض المسيسيبي', -91, 32]],
    water: [['نهر المسيسيبي', -91, 35], ['البحيرات العظمى', -84, 45], ['نهر سانت لورانس', -73, 46], ['خليج المكسيك', -90, 24], ['المحيط الهادئ', -140, 35]],
    minerals: [['بترول تكساس', -101, 31], ['فحم الأبلاش', -81, 38], ['حديد كندا', -70, 52], ['ذهب ألاسكا', -150, 64], ['نحاس المكسيك', -110, 29]],
    capitals: [['واشنطن', -77.04, 38.9], ['أوتاوا', -75.7, 45.4], ['مكسيكو سيتي', -99.13, 19.43], ['هافانا', -82.37, 23.1], ['بنما', -79.52, 9.0]],
  },
  southAmerica: {
    terrain: [['جبال الأنديز', -70, -20], ['هضبة البرازيل', -48, -15], ['هضبة جيانا', -60, 5], ['سهول البمباس', -61, -35], ['حوض الأمازون', -60, -4], ['صحراء أتاكاما', -70, -24]],
    water: [['نهر الأمازون', -60, -4], ['نهر بارانا', -58, -27], ['بحيرة تيتيكاكا', -69.3, -15.8], ['المحيط الأطلسي', -35, -20], ['المحيط الهادئ', -80, -20]],
    minerals: [['نحاس تشيلي', -70, -25], ['حديد البرازيل', -44, -19], ['بترول فنزويلا', -67, 8], ['قصدير بوليفيا', -66, -17], ['فضة بيرو', -75, -12]],
    capitals: [['برازيليا', -47.9, -15.8], ['بوينس آيرس', -58.38, -34.6], ['سانتياجو', -70.67, -33.45], ['ليما', -77.04, -12.05], ['كاراكاس', -66.9, 10.5]],
  },
  australia: {
    terrain: [['الحاجز الشرقي الكبير', 148, -28], ['هضبة غرب أستراليا', 122, -25], ['السهول الوسطى', 136, -26], ['صحراء فكتوريا الكبرى', 128, -29], ['جبال الألب الأسترالية', 148, -36]],
    water: [['نهر موراي', 143, -35], ['بحيرة إير', 137, -28], ['بحر تسمان', 160, -38], ['المحيط الهندي', 112, -28], ['المحيط الهادئ', 170, -20]],
    minerals: [['حديد غرب أستراليا', 119, -22], ['فحم كوينزلاند', 148, -23], ['ذهب كالغورلي', 121, -31], ['بوكسيت شمال أستراليا', 137, -13], ['غاز الساحل الغربي', 114, -21]],
    capitals: [['كانبرا', 149.1, -35.3], ['سيدني', 151.2, -33.9], ['ملبورن', 144.96, -37.8], ['ويلينغتون', 174.78, -41.29], ['بورت مورسبي', 147.18, -9.44]],
  },
  world: {
    terrain: [['جبال الهيمالايا', 86, 28], ['جبال الأنديز', -70, -20], ['جبال الروكي', -112, 45], ['جبال الألب', 10, 46], ['هضبة التبت', 88, 32], ['سهول أوروبا الكبرى', 20, 52], ['الصحراء الكبرى', 12, 23]],
    water: [['المحيط الهادئ', -150, 0], ['المحيط الأطلسي', -30, 5], ['المحيط الهندي', 80, -20], ['نهر الأمازون', -60, -4], ['البحر المتوسط', 18, 35]],
    minerals: [['بترول الخليج العربي', 49, 25], ['حديد أستراليا', 120, -25], ['نحاس تشيلي', -70, -25], ['فحم الصين', 112, 36], ['ذهب جنوب إفريقيا', 27, -27]],
    capitals: [['القاهرة', 31.2, 30], ['باريس', 2.35, 48.85], ['نيودلهي', 77.2, 28.6], ['برازيليا', -47.9, -15.8], ['كانبرا', 149.1, -35.3]],
  },
});

export const GEOGRAPHY_SYMBOL_GROUPS = Object.freeze([
  {
    id: 'surface', label: 'مظاهر السطح', items: [
      { id: 'mountains', label: 'جبال', hint: 'سلاسل جبلية', symbol: '▲', color: '#8d6e4c' },
      { id: 'plateaus', label: 'هضاب', hint: 'سطوح مرتفعة', symbol: '▰', color: '#c38f5a' },
      { id: 'plains', label: 'سهول', hint: 'أراضٍ منبسطة', symbol: '▬', color: '#7aa46f' },
      { id: 'depression', label: 'منخفضات', hint: 'أرض أقل من محيطها', symbol: '▽', color: '#8b6f8f' },
      { id: 'desert', label: 'صحارى', hint: 'مناطق جافة', symbol: '◌', color: '#d6ae38' },
      { id: 'valley', label: 'أودية', hint: 'ممرات بين المرتفعات', symbol: '∨', color: '#8d7356' },
      { id: 'delta', label: 'دلتا', hint: 'تفرعات مصب النهر', symbol: 'Δ', color: '#4d9e6f' },
      { id: 'volcano', label: 'بركان', hint: 'نشاط بركاني', symbol: '♨', color: '#c94b3c' },
      { id: 'oasis', label: 'واحة', hint: 'مياه ونبات في الصحراء', symbol: '✺', color: '#2f9d78' },
      { id: 'island', label: 'جزيرة', hint: 'يابس تحيط به المياه', symbol: '◐', color: '#8aa56c' },
      { id: 'peninsula', label: 'شبه جزيرة', hint: 'يابس تحيط به المياه من ثلاث جهات', symbol: '◒', color: '#9a8a5b' },
      { id: 'basin', label: 'حوض', hint: 'منطقة منخفضة لتجمع المياه', symbol: '⌣', color: '#7c718e' },
      { id: 'coast', label: 'ساحل', hint: 'منطقة التقاء اليابس بالماء', symbol: '⌇', color: '#4b91a8' },
    ],
  },
  {
    id: 'water', label: 'المياه', items: [
      { id: 'river', label: 'نهر', hint: 'مجرى مائي', symbol: '≈', color: '#2f80ed' },
      { id: 'lake', label: 'بحيرة', hint: 'مسطح مائي داخلي', symbol: '⬭', color: '#3a9ad9' },
      { id: 'sea', label: 'بحر', hint: 'مسطح مائي', symbol: '≋', color: '#2979b8' },
      { id: 'ocean', label: 'محيط', hint: 'مسطح مائي واسع', symbol: '◉', color: '#155a91' },
      { id: 'canal', label: 'قناة', hint: 'مجرى مائي صناعي', symbol: '║', color: '#55a8d8' },
      { id: 'waterfall', label: 'شلال', hint: 'سقوط مياه', symbol: '⇊', color: '#4fa7cf' },
      { id: 'fish', label: 'ثروة سمكية', hint: 'سواحل وبحيرات', symbol: '◈', color: '#2f80ed' },
      { id: 'gulf', label: 'خليج', hint: 'امتداد مائي داخل اليابس', symbol: '⊂', color: '#2e78b7' },
      { id: 'strait', label: 'مضيق', hint: 'ممر مائي ضيق', symbol: '⇆', color: '#357fa9' },
      { id: 'bay', label: 'خور/خليج صغير', hint: 'تجويف ساحلي', symbol: '◡', color: '#4a8fb5' },
      { id: 'spring', label: 'عين ماء', hint: 'مياه جوفية تظهر على السطح', symbol: '⊙', color: '#4ab5b4' },
      { id: 'dam', label: 'سد', hint: 'حاجز للتحكم في المياه', symbol: '▥', color: '#617c91' },
      { id: 'groundwater', label: 'مياه جوفية', hint: 'مخزون مائي تحت سطح الأرض', symbol: '◉', color: '#4a8bb7' },
    ],
  },
  {
    id: 'resources', label: 'الثروات', items: [
      { id: 'minerals', label: 'معادن', hint: 'ثروات معدنية', symbol: '◆', color: '#b85c9e' },
      { id: 'petroleum', label: 'بترول', hint: 'حقول النفط', symbol: '●', color: '#1e1e22' },
      { id: 'gas', label: 'غاز طبيعي', hint: 'حقول الغاز', symbol: '◍', color: '#df8d32' },
      { id: 'coal', label: 'فحم', hint: 'مناجم الفحم', symbol: '■', color: '#343434' },
      { id: 'iron', label: 'حديد', hint: 'خام الحديد', symbol: 'Fe', color: '#8f5f55' },
      { id: 'gold', label: 'ذهب', hint: 'مناجم الذهب', symbol: 'Au', color: '#d5aa22' },
      { id: 'phosphate', label: 'فوسفات', hint: 'مناجم الفوسفات', symbol: 'P', color: '#a779b8' },
      { id: 'agriculture', label: 'زراعة', hint: 'مناطق زراعية', symbol: '✦', color: '#4d9e6f' },
      { id: 'animal', label: 'ثروة حيوانية', hint: 'مناطق الرعي', symbol: '♞', color: '#5d8f57' },
      { id: 'salt', label: 'ملح', hint: 'ملاحات ومناجم الملح', symbol: '◇', color: '#d8d1c0' },
      { id: 'solar', label: 'طاقة شمسية', hint: 'مناطق الطاقة الشمسية', symbol: '☀', color: '#e5aa2c' },
      { id: 'wind', label: 'طاقة رياح', hint: 'مزارع الرياح', symbol: '✤', color: '#6aa9b7' },
    ],
  },
  {
    id: 'human', label: 'ظواهر بشرية', items: [
      { id: 'capital', label: 'عاصمة', hint: 'عاصمة دولة', symbol: '★', color: '#d64545' },
      { id: 'city', label: 'مدينة', hint: 'مدينة مهمة', symbol: '●', color: '#e26d5a' },
      { id: 'port', label: 'ميناء', hint: 'ميناء بحري', symbol: '⚓', color: '#376c9d' },
      { id: 'industry', label: 'صناعة', hint: 'مركز صناعي', symbol: '⚙', color: '#6f7783' },
      { id: 'population', label: 'سكان', hint: 'منطقة كثافة سكانية', symbol: '♟', color: '#8c5a9e' },
      { id: 'tourism', label: 'سياحة', hint: 'مركز سياحي', symbol: '✹', color: '#d17a35' },
      { id: 'border', label: 'حدود سياسية', hint: 'خط فاصل بين الدول', symbol: '┄', color: '#d59a46' },
      { id: 'road', label: 'طريق', hint: 'محور نقل بري', symbol: '═', color: '#a47855' },
      { id: 'railway', label: 'سكة حديد', hint: 'خط نقل بالقطارات', symbol: '╫', color: '#606b76' },
      { id: 'airport', label: 'مطار', hint: 'مطار أو محور جوي', symbol: '✈', color: '#657ca8' },
      { id: 'archaeology', label: 'أثر تاريخي', hint: 'موقع أثري أو حضاري', symbol: '⌂', color: '#b27a42' },
    ],
  },  {
    id: 'reference', label: 'علامات وبيانات', items: [
      { id: 'pin', label: 'دبوس', hint: 'علامة بدون اسم أو مع ملاحظة', symbol: '📍', color: '#d64545' },
      { id: 'country', label: 'دولة', hint: 'تحديد دولة أو إقليم', symbol: '▱', color: '#d6ae38' },
      { id: 'latitude', label: 'دائرة عرض', hint: 'خط عرض مرجعي', symbol: '↔', color: '#5b8fb9' },
      { id: 'longitude', label: 'خط طول', hint: 'خط طول مرجعي', symbol: '↕', color: '#5b8fb9' },
      { id: 'grid', label: 'شبكة إحداثيات', hint: 'خطوط الطول ودوائر العرض', symbol: '▦', color: '#628ca4' },
      { id: 'population-low', label: 'سكان قليل', hint: 'كثافة سكانية منخفضة', symbol: '●', color: '#8cc78b' },
      { id: 'population-medium', label: 'سكان متوسط', hint: 'كثافة سكانية متوسطة', symbol: '●', color: '#e2b34f' },
      { id: 'population-high', label: 'سكان كثيف', hint: 'كثافة سكانية مرتفعة', symbol: '●', color: '#d6534d' },
      { id: 'note', label: 'ملاحظة', hint: 'معلومة أو شرح على الخريطة', symbol: '✎', color: '#8c5a9e' },
    ],
  },
]);

export const GEOGRAPHY_SYMBOLS = GEOGRAPHY_SYMBOL_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })));

export const GRADE_MAP_RECOMMENDATIONS = Object.freeze({
  'الصف الرابع الابتدائي': { defaultRegion: 'egypt', recommended: ['egypt'] },
  'الصف الخامس الابتدائي': { defaultRegion: 'egypt', recommended: ['egypt'] },
  'الصف السادس الابتدائي': { defaultRegion: 'arab', recommended: ['arab'] },
  'الصف الأول الإعدادي': { defaultRegion: 'africa', recommended: ['africa'] },
  'الصف الثاني الإعدادي': { defaultRegion: 'asia', recommended: ['asia', 'europe'] },
  'الصف الثالث الإعدادي': { defaultRegion: 'northAmerica', recommended: ['northAmerica', 'southAmerica', 'australia'] },
  'الصف الأول الثانوي': { defaultRegion: 'world', recommended: ['world', 'egypt', 'arab', 'africa', 'asia', 'europe'] },
  'الصف الثاني الثانوي': { defaultRegion: 'world', recommended: ['world', 'africa', 'asia', 'europe', 'northAmerica', 'southAmerica'] },
  'الصف الثالث الثانوي': { defaultRegion: 'world', recommended: ['world', 'egypt', 'arab', 'africa', 'asia', 'europe'] },
});

function normalizeGradeLabel(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FF0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getGradeMapRecommendation(grade = '') {
  const normalizedGrade = normalizeGradeLabel(grade);
  if (!normalizedGrade) return { defaultRegion: 'world', recommended: ['world'] };
  const exact = Object.entries(GRADE_MAP_RECOMMENDATIONS).find(([label]) => normalizeGradeLabel(label) === normalizedGrade);
  if (exact) return exact[1];
  const partial = Object.entries(GRADE_MAP_RECOMMENDATIONS).find(([label]) => {
    const normalizedLabel = normalizeGradeLabel(label);
    return normalizedGrade.includes(normalizedLabel) || normalizedLabel.includes(normalizedGrade);
  });
  return partial?.[1] || { defaultRegion: 'world', recommended: ['world'] };
}

export function coordsToPath(coords, project) {
  return coords.map((ring) => `${ring.map((point, index) => `${index ? 'L' : 'M'}${project(point[0], point[1]).join(',')}`).join(' ')} Z`).join(' ');
}

export function geometryPath(geometry, project) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') return coordsToPath(geometry.coordinates, project);
  return geometry.coordinates.map((polygon) => coordsToPath(polygon, project)).join(' ');
}

export function featureCenter(feature) {
  const points = [];
  const walk = (value) => (Array.isArray(value?.[0]) ? value.forEach(walk) : points.push(value));
  walk(feature?.geometry?.coordinates || []);
  return points.length
    ? [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length]
    : [0, 0];
}

export function createMapProjector(regionKey, width = 1000, height = 620) {
  const region = GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world;
  const [minX, minY, maxX, maxY] = region.bounds;
  const midLon = (minX + maxX) / 2;
  const midLat = (minY + maxY) / 2;
  const latitudeCorrection = Math.max(0.42, Math.cos((midLat * Math.PI) / 180));
  const projectedWidth = Math.max(1, (maxX - minX) * latitudeCorrection);
  const projectedHeight = Math.max(1, maxY - minY);
  const padding = regionKey === 'world' ? 24 : 34;
  const scale = Math.min((width - padding * 2) / projectedWidth, (height - padding * 2) / projectedHeight);
  return (longitude, latitude) => [
    width / 2 + (longitude - midLon) * latitudeCorrection * scale,
    height / 2 + (midLat - latitude) * scale,
  ];
}

export function getRegionCountries(geo, regionKey) {
  const region = GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world;
  const source = [...(geo?.features || []), ...supplementalCountries];
  return source.filter(region.countryFilter);
}

export function getCountryFeatureId(feature, index = 0) {
  const iso = String(feature?.properties?.iso_a3 || '').trim();
  if (iso && iso !== '-99') return iso;
  const name = String(feature?.properties?.name || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `X-${name || index}`;
}

export function getRegionLayerItems(geo, regionKey, layerKey) {
  const countries = getRegionCountries(geo, regionKey);
  if (layerKey === 'countries' || layerKey === 'borders' || layerKey === 'population') {
    return countries.map((feature, index) => ({
      id: getCountryFeatureId(feature, index),
      name: layerKey === 'population'
        ? `سكان ${getCountryName(feature)}`
        : layerKey === 'borders'
          ? `حدود ${getCountryName(feature)}`
          : getCountryName(feature),
      feature,
      coord: featureCenter(feature),
    }));
  }

  const derived = {
    mountains: { source: 'terrain', match: /(جبال|جبل|مرتفعات|حاجز)/u },
    plateaus: { source: 'terrain', match: /(هضبة|هضاب)/u },
    plains: { source: 'terrain', match: /(سهل|سهول|دلتا|حوض|منخفض|وادي)/u },
    deserts: { source: 'terrain', match: /(صحراء|صحارى)/u },
    rivers: { source: 'water', match: /(نهر)/u },
    seas: { source: 'water', match: /(بحر|خليج|بحيرة|قناة|مضيق)/u },
    oceans: { source: 'water', match: /(محيط)/u },
    cities: { source: 'capitals', match: /.*/u },
  };

  if (layerKey === 'latitude' || layerKey === 'longitude') {
    const region = GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world;
    const [minX, minY, maxX, maxY] = region.bounds;
    const longitude = (minX + maxX) / 2;
    const latitude = (minY + maxY) / 2;
    const lines = layerKey === 'latitude'
      ? [
          ['خط الاستواء', longitude, Math.max(minY, Math.min(maxY, 0))],
          ['مدار السرطان', longitude, Math.max(minY, Math.min(maxY, 23.5))],
          ['مدار الجدي', longitude, Math.max(minY, Math.min(maxY, -23.5))],
        ]
      : [
          ['خط جرينتش', Math.max(minX, Math.min(maxX, 0)), latitude],
          ['خط طول 30° شرقًا', Math.max(minX, Math.min(maxX, 30)), latitude],
          ['خط طول 60° شرقًا', Math.max(minX, Math.min(maxX, 60)), latitude],
        ];
    return lines
      .filter((item) => item[1] >= minX && item[1] <= maxX && item[2] >= minY && item[2] <= maxY)
      .map((item, index) => ({ id: `${regionKey}:${layerKey}:${index}`, name: item[0], coord: [item[1], item[2]] }));
  }

  if (layerKey === 'directions') {
    const [minX, minY, maxX, maxY] = (GEOGRAPHY_REGIONS[regionKey] || GEOGRAPHY_REGIONS.world).bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return [
      ['الشمال', centerX, maxY - ((maxY - minY) * .08)],
      ['الجنوب', centerX, minY + ((maxY - minY) * .08)],
      ['الشرق', maxX - ((maxX - minX) * .08), centerY],
      ['الغرب', minX + ((maxX - minX) * .08), centerY],
    ].map((item, index) => ({ id: `${regionKey}:directions:${index}`, name: item[0], coord: [item[1], item[2]] }));
  }

  const config = derived[layerKey];
  const sourceKey = config?.source || layerKey;
  const source = GEOGRAPHY_FEATURES[regionKey]?.[sourceKey] || [];
  return source
    .filter((item) => !config?.match || config.match.test(item[0]))
    .map((item, index) => ({
      id: `${regionKey}:${layerKey}:${index}`,
      name: item[0],
      coord: [item[1], item[2]],
    }));
}
