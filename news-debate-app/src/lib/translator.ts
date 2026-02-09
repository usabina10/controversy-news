// תרגום אמיתי עם Google Translate
export async function realTranslate(text: string, targetLang: 'he' | 'ru' | 'en'): Promise<string> {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.slice(0, 400))}`
    );
    const data = await res.json();
    return data[0][0][0] || text.slice(0, 300) + '...';
  } catch (e) {
    console.log('Translate fallback');
    return simpleTranslate(text, targetLang);
  }
}

function simpleTranslate(text: string, lang: 'he' | 'ru' | 'en'): string {
  const replacements = {
    'נתניהו': lang === 'ru' ? 'Нетаньяху' : 'Netanyahu',
    'בן גביר': lang === 'ru' ? 'Бен Гвир' : 'Ben Gvir',
    'קנסות': lang === 'ru' ? 'штрафы' : 'fines',
    'טלפון': lang === 'ru' ? 'телефон' : 'phone',
    'בטיחות': lang === 'ru' ? 'безопасность' : 'safety'
  };

  let result = text;
  Object.entries(replacements).forEach(([he, trans]) => {
    result = result.replace(new RegExp(he, 'gi'), trans);
  });
  return result.length > 300 ? result.slice(0, 300) + '...' : result;
}

// תרגום ידיעה שלמה
export async function translateNews(rawNews: any, lang: 'he' | 'ru' | 'en'): Promise<any> {
  if (lang === 'he') return rawNews;

  const [title, description] = await Promise.all([
    realTranslate(rawNews.title, lang),
    realTranslate(rawNews.description, lang)
  ]);

  return {
    ...rawNews,
    title,
    description
  };
}

export const translations = {
  he: {
    title: 'חדשות חיות - דיון 3 צדדים',
    subtitle: 'עובדות • ימין • שמאל',
    loading: 'טוען ידיעה חמה...',
    facts: 'עובדות טהורות',
    right: 'פרשנות ימנית',
    left: 'פרשנות שמאלנית',
    debate: '🎤 דיון קולי 3 צדדים',
    refresh: '🔄 ידיעה חדשה',
    source: 'מקור'
  },
  ru: {
    title: 'Живые новости - дебаты 3 стороны',
    subtitle: 'Факты • Правые • Левые',
    loading: 'Загружаем горячую новость...',
    facts: 'Чистые факты',
    right: 'Правый анализ',
    left: 'Левый анализ',
    debate: '🎤 Аудио дебаты',
    refresh: '🔄 Новая новость',
    source: 'Источник'
  },
  en: {
    title: 'Live News - 3-Way Debate',
    subtitle: 'Facts • Right • Left',
    loading: 'Loading hot news...',
    facts: 'Pure Facts',
    right: 'Right Wing Analysis',
    left: 'Left Wing Analysis',
    debate: '🎤 Audio Debate',
    refresh: '🔄 New Story',
    source: 'Source'
  }
} as const;

export function t(lang: 'he' | 'ru' | 'en', key: keyof typeof translations['he']): string {
  return translations[lang][key] || key;
}
