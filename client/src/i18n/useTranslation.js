import { useLanguage } from './LanguageContext';

export function useTranslation() {
  const { language, changeLanguage, t } = useLanguage();
  return { language, changeLanguage, t };
}
