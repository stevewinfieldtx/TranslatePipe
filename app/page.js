'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Language config ───────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     flag: '🇫🇷' },
  { code: 'de', label: 'German',     flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'th', label: 'Thai',       flag: '🇹🇭' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
];

const getLangLabel = (code) => LANGUAGES.find(l => l.code === code)?.label || code;
