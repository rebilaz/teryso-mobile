import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

import { ThemeColors, ThemeMode, themes } from '@/constants/theme';

const STORAGE_KEY = 'teryso-mobile-theme-v1';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function TerysoThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY).then((storedMode) => {
      if (mounted && (storedMode === 'light' || storedMode === 'dark')) {
        setModeState(storedMode);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: themes[mode],
      isDark: mode === 'dark',
      mode,
      setMode,
      toggleTheme,
    }),
    [mode, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTerysoTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTerysoTheme doit être utilisé dans TerysoThemeProvider.');
  }

  return context;
}
