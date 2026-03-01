import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enUS from './en-US/common.json';
import zhCN from './zh-CN/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'zh-CN': { translation: zhCN },
    },
    supportedLngs: ['en-US', 'zh-CN'],
    load: 'currentOnly',
    fallbackLng: 'en-US',
    nonExplicitSupportedLngs: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
