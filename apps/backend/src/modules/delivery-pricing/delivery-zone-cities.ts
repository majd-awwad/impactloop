/** Normalized lowercase city keys for zone classification. */
const JERUSALEM_KEYS = new Set([
  'jerusalem',
  'al quds',
  'al-quds',
  'alquds',
  'القدس',
  'yerushalayim',
  'ירושלים',
]);

const INSIDE_48_KEYS = new Set([
  'tel aviv',
  'tel-aviv',
  'telaviv',
  'תל אביב',
  'haifa',
  'חיפה',
  'beer sheva',
  'beersheva',
  'beer-sheva',
  'באר שבע',
  'ashdod',
  'אשדוד',
  'ashkelon',
  'אשקלון',
  'netanya',
  'נתניה',
  'rishon lezion',
  'rishon leziyon',
  'ראשון לציון',
  'petah tikva',
  'petach tikva',
  'פתח תקווה',
  'holon',
  'חולון',
  'bnei brak',
  'bnei braq',
  'בני ברק',
  'ramat gan',
  'רמת גן',
  'rehovot',
  'רחובות',
  'bat yam',
  'בת ים',
  'herzliya',
  'herzliyya',
  'הרצליה',
  'kfar saba',
  'kfar-saba',
  'כפר סבא',
  'raanana',
  'רעננה',
  'modiin',
  'מודיעין',
  'acre',
  'akko',
  'עכו',
  'nazareth',
  'נצרת',
  'eilat',
  'אילת',
  'tiberias',
  'טבריה',
  'safed',
  'tzfat',
  'צפת',
  'lod',
  'lydda',
  'לוד',
  'ramla',
  'רמלה',
  'nahariya',
  'נהריה',
  'afula',
  'עפולה',
  'hadera',
  'חדרה',
  'karmiel',
  'כרמיאל',
  'dimona',
  'דימונה',
  'yokneam',
  'יקנעם',
  'givatayim',
  'גבעתיים',
  'rosh haayin',
  'ראש העין',
  'hod hasharon',
  'הוד השרון',
]);

const WEST_BANK_KEYS = new Set([
  'nablus',
  'نابلس',
  'jenin',
  'جنين',
  'ramallah',
  'رام الله',
  'al-bireh',
  'albireh',
  'hebron',
  'الخليل',
  'bethlehem',
  'بيت لحم',
  'tulkarm',
  'طولكرم',
  'qalqilya',
  'قلقيلية',
  'jericho',
  'أريحا',
  'ariha',
  'tubas',
  'طوباس',
  'salfit',
  'سلفيت',
  'rawabi',
  'روابي',
]);

export const normalizeCityName = (city: string): string =>
  city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'");

export const isJerusalemCity = (city: string): boolean => {
  const normalized = normalizeCityName(city);
  return JERUSALEM_KEYS.has(normalized);
};

export const isInside48City = (city: string): boolean => {
  const normalized = normalizeCityName(city);
  return INSIDE_48_KEYS.has(normalized);
};

export const isWestBankCity = (city: string): boolean => {
  const normalized = normalizeCityName(city);
  return WEST_BANK_KEYS.has(normalized);
};

export const citiesMatch = (a: string, b: string): boolean =>
  normalizeCityName(a) === normalizeCityName(b);

export const normalizeDropoffKey = (city: string, area?: string | null): string => {
  const cityKey = normalizeCityName(city);
  const areaKey = area?.trim() ? normalizeCityName(area) : '';
  return areaKey ? `${cityKey}|${areaKey}` : cityKey;
};
