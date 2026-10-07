/** Время жизни кэша информации о чате (7 дней) */
export const CACHE_TTL_CHAT_INFO_MS = 7 * 24 * 60 * 60 * 1000;

/** Время жизни кэша метаданных TikTok по URL (24 часа) */
export const CACHE_TTL_TIKTOK_INFO_MS = 24 * 60 * 60 * 1000;

/** Время жизни кэша видео TikTok (2 дня) */
export const CACHE_TTL_TIKTOK_VIDEO_MS = 2 * 24 * 60 * 60 * 1000;

/** Время жизни кэша видео Instagram Reels (24 часа) */
export const CACHE_TTL_INSTAGRAM_VIDEO_MS = 24 * 60 * 60 * 1000;

/** Время жизни кэша YouTube Shorts (2 дня) */
export const CACHE_TTL_YOUTUBE_SHORTS_MS = 2 * 24 * 60 * 60 * 1000;

/** Время жизни кэша скриншота веб-страницы (12 часов) */
export const CACHE_TTL_WEBPAGE_SCREENSHOT_MS = 12 * 60 * 60 * 1000;

/** Время жизни кэша ответа AI на упоминание бота (1 час) */
export const CACHE_TTL_AI_RESPONSE_MS = 60 * 60 * 1000;

/** Время жизни кэша аудио из текста (6 часов) */
export const CACHE_TTL_TEXT_TO_AUDIO_MS = 6 * 60 * 60 * 1000;

/** Интервал плановой очистки протухшего кэша (48 часов) */
export const CACHE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 * 2;

export const CACHE_KEY_PREFIX = {
  CHAT_INFO: 'chat-info',
  TIKTOK_INFO: 'tiktok-info',
  TIKTOK_VIDEO: 'tiktok-video',
  INSTAGRAM_VIDEO: 'instagram-video',
  YOUTUBE_SHORTS: 'youtube-shorts',
  WEBPAGE_SCREENSHOT: 'webpage-screenshot',
  AI_RESPONSE: 'ai-response',
  TEXT_TO_AUDIO: 'text-to-audio',
} as const;
