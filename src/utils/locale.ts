import { enUS, es, fr, de, pt, it } from 'date-fns/locale';

export const getBrowserLocale = () => {
  const lang = navigator.language ? navigator.language.split('-')[0] : 'en';
  switch (lang) {
    case 'es': return es;
    case 'fr': return fr;
    case 'de': return de;
    case 'pt': return pt;
    case 'it': return it;
    default: return enUS;
  }
};