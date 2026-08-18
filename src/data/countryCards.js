export const COUNTRY_CARD_CATEGORIES = Object.freeze([
  { key: "arab", label: "الوطن العربي" },
  { key: "africa", label: "أفريقيا" },
  { key: "europe-asia", label: "أوروبا وآسيا" },
  { key: "americas-australia", label: "الأمريكتان وأستراليا" },
]);

const rawCards = [
  ["01", "مصر", "arab", "القاهرة", "العربية"],
  ["02", "السعودية", "arab", "الرياض", "العربية"],
  ["03", "الإمارات", "arab", "أبوظبي", "العربية"],
  ["04", "العراق", "arab", "بغداد", "العربية والكردية"],
  ["05", "السودان", "arab", "الخرطوم", "العربية والإنجليزية"],
  ["06", "الجزائر", "arab", "الجزائر", "العربية والأمازيغية"],
  ["07", "المغرب", "arab", "الرباط", "العربية والأمازيغية"],
  ["08", "فلسطين", "arab", "القدس", "العربية"],
  ["09", "جنوب أفريقيا", "africa", "بريتوريا", "12 لغة رسمية"],
  ["10", "نيجيريا", "africa", "أبوجا", "الإنجليزية"],
  [
    "11",
    "إثيوبيا",
    "africa",
    "أديس أبابا",
    "الأمهرية وأورومو والصومالية والتيغرينية والعفرية",
  ],
  ["12", "الكونغو الديمقراطية", "africa", "كينشاسا", "الفرنسية"],
  ["13", "الصين", "europe-asia", "بكين", "الصينية (الماندرين)"],
  ["14", "الهند", "europe-asia", "نيودلهي", "الهندية والإنجليزية"],
  ["15", "اليابان", "europe-asia", "طوكيو", "اليابانية"],
  ["16", "كوريا الجنوبية", "europe-asia", "سيول", "الكورية"],
  ["17", "إندونيسيا", "europe-asia", "جاكرتا", "الإندونيسية"],
  ["18", "باكستان", "europe-asia", "إسلام آباد", "الأردية والإنجليزية"],
  ["19", "تركيا", "europe-asia", "أنقرة", "التركية"],
  ["20", "إيران", "europe-asia", "طهران", "الفارسية"],
  ["21", "روسيا", "europe-asia", "موسكو", "الروسية"],
  ["22", "بريطانيا", "europe-asia", "لندن", "الإنجليزية"],
  ["23", "فرنسا", "europe-asia", "باريس", "الفرنسية"],
  ["24", "ألمانيا", "europe-asia", "برلين", "الألمانية"],
  ["25", "إيطاليا", "europe-asia", "روما", "الإيطالية"],
  ["26", "إسبانيا", "europe-asia", "مدريد", "الإسبانية"],
  ["27", "اليونان", "europe-asia", "أثينا", "اليونانية"],
  [
    "28",
    "الولايات المتحدة",
    "americas-australia",
    "واشنطن العاصمة",
    "الإنجليزية",
  ],
  ["29", "كندا", "americas-australia", "أوتاوا", "الإنجليزية والفرنسية"],
  ["30", "البرازيل", "americas-australia", "برازيليا", "البرتغالية"],
  ["31", "الأرجنتين", "americas-australia", "بوينس آيرس", "الإسبانية"],
  ["32", "المكسيك", "americas-australia", "مكسيكو سيتي", "الإسبانية"],
  ["33", "تشيلي", "americas-australia", "سانتياغو", "الإسبانية"],
  ["34", "أستراليا", "americas-australia", "كانبرا", "الإنجليزية"],
  [
    "35",
    "نيوزيلندا",
    "americas-australia",
    "ويلينغتون",
    "الإنجليزية والماورية ولغة الإشارة النيوزيلندية",
  ],
];

export const DEFAULT_COUNTRY_CARD = Object.freeze({
  key: "00",
  name: "بطاقة دولة افتراضية",
  category: "default",
  asset: "/whiteboard/country-cards/00.png",
  capital: "",
  language: "",
  isDefault: true,
});

export const COUNTRY_CARDS = Object.freeze(
  rawCards.map(([key, name, category, capital, language]) => ({
    key,
    name,
    category,
    asset: `/whiteboard/country-cards/${key}.png`,
    capital,
    language,
    isDefault: false,
  })),
);

export const COUNTRY_CARD_MAP = Object.freeze(
  Object.fromEntries(
    [DEFAULT_COUNTRY_CARD, ...COUNTRY_CARDS].map((item) => [item.key, item]),
  ),
);

export function countryCardsForCategory(category) {
  return COUNTRY_CARDS.filter((item) => item.category === category)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "ar"));
}
