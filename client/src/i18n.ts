import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { en_translations } from './locales/en/translation';
import { de_translations } from './locales/de/translation';
import { pt_br_translations } from './locales/pt_br/translation';
import { i18nextPlugin } from 'translation-check';
import { es_translations } from './locales/es/translation';

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .use(i18nextPlugin)
  .init({
    debug: true,
    fallbackLng: 'en',
    supportedLngs: ["en","de","es"],
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: { translation: en_translations },
      de: { translation: de_translations },
      es: { translation: es_translations }
      }
    }
  );

export default i18n;