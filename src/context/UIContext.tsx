"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "@/lib/translations";

type Theme = "dark" | "light";

interface UIContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: typeof translations.en;
  isArabic: boolean;
  isLight: boolean;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("dark");

  // Load from local storage
  useEffect(() => {
    const savedLang = localStorage.getItem("coinbin_lang") as Language;
    const savedTheme = localStorage.getItem("coinbin_theme") as Theme;
    if (savedLang) setLanguage(savedLang);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // Sync to local storage and DOM
  useEffect(() => {
    localStorage.setItem("coinbin_lang", language);
    localStorage.setItem("coinbin_theme", theme);
    
    // Apply theme class to root
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }

    // Apply dir to body
    const body = window.document.body;
    body.style.direction = language === "ar" ? "rtl" : "ltr";
  }, [language, theme]);

  const t = translations[language];
  const isArabic = language === "ar";
  const isLight = theme === "light";

  return (
    <UIContext.Provider value={{ language, setLanguage, theme, setTheme, t, isArabic, isLight }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
