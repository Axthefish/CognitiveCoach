/**
 * 语言切换器
 * 支持中英文切换
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Language = 'zh' | 'en';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  className?: string;
}

const LANGUAGES = [
  { code: 'zh' as Language, name: '中文', nativeName: '简体中文' },
  { code: 'en' as Language, name: 'EN', nativeName: 'English' },
];

export function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  className,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const currentLang = LANGUAGES.find(l => l.code === currentLanguage);
  
  return (
    <div className={cn('relative', className)}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-button flex items-center gap-2 px-4 py-2 rounded-lg text-white"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="切换语言"
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">{currentLang?.name}</span>
      </motion.button>
      
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 下拉菜单 */}
          <motion.div
            className="absolute top-full right-0 mt-2 glass-card-primary rounded-lg overflow-hidden min-w-[180px] z-50"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {LANGUAGES.map((lang) => (
              <motion.button
                key={lang.code}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-3 flex items-center justify-between gap-3',
                  'text-left transition-colors',
                  'hover:bg-white/10',
                  currentLanguage === lang.code && 'bg-white/5'
                )}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {lang.nativeName}
                  </div>
                  <div className="text-xs text-gray-400">{lang.name}</div>
                </div>
                
                {currentLanguage === lang.code && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}

/**
 * 简化版语言切换器（图标 + 悬停显示）
 */
export function CompactLanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  className,
}: LanguageSwitcherProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      {LANGUAGES.map((lang) => (
        <motion.button
          key={lang.code}
          onClick={() => onLanguageChange(lang.code)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            currentLanguage === lang.code
              ? 'glass-card-primary text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`切换到${lang.nativeName}`}
          aria-current={currentLanguage === lang.code}
        >
          {lang.name}
        </motion.button>
      ))}
    </div>
  );
}

