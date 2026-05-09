import { useEffect } from 'react';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';

export const usePageTitle = (pageTitle: string) => {
  const { settings } = useWhiteLabel();

  useEffect(() => {
    document.title = `${pageTitle} | ${settings.app_name}`;
    
    return () => {
      // Al desmontar, regresamos al nombre original
      document.title = settings.app_name;
    };
  }, [pageTitle, settings.app_name]);
};