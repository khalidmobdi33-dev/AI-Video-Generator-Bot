/**
 * Centralized logging utility with emojis and better formatting
 */

const LOG_LEVELS = {
  INFO: '📝',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  DEBUG: '🔍',
  DATABASE: '💾',
  API: '🌐',
  BOT: '🤖',
  VIDEO: '🎬',
  IMAGE: '🖼️',
  PROCESSING: '⚙️'
};

/**
 * Get formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with emoji and timestamp
 */
function formatLog(emoji, category, message, data = null) {
  const timestamp = getTimestamp();
  let logMessage = `[${timestamp}] ${emoji} [${category}] ${message}`;
  
  if (data) {
    if (typeof data === 'object') {
      logMessage += `\n${JSON.stringify(data, null, 2)}`;
    } else {
      logMessage += ` | ${data}`;
    }
  }
  
  return logMessage;
}

export const logger = {
  info: (category, message, data) => {
    console.log(formatLog(LOG_LEVELS.INFO, category, message, data));
  },
  
  success: (category, message, data) => {
    console.log(formatLog(LOG_LEVELS.SUCCESS, category, message, data));
  },
  
  error: (category, message, data) => {
    console.error(formatLog(LOG_LEVELS.ERROR, category, message, data));
  },
  
  warning: (category, message, data) => {
    console.warn(formatLog(LOG_LEVELS.WARNING, category, message, data));
  },
  
  debug: (category, message, data) => {
    console.log(formatLog(LOG_LEVELS.DEBUG, category, message, data));
  },
  
  database: (message, data) => {
    console.log(formatLog(LOG_LEVELS.DATABASE, 'DATABASE', message, data));
  },
  
  api: (message, data) => {
    console.log(formatLog(LOG_LEVELS.API, 'API', message, data));
  },
  
  bot: (message, data) => {
    console.log(formatLog(LOG_LEVELS.BOT, 'BOT', message, data));
  },
  
  video: (message, data) => {
    console.log(formatLog(LOG_LEVELS.VIDEO, 'VIDEO', message, data));
  },
  
  image: (message, data) => {
    console.log(formatLog(LOG_LEVELS.IMAGE, 'IMAGE', message, data));
  },
  
  processing: (message, data) => {
    console.log(formatLog(LOG_LEVELS.PROCESSING, 'PROCESSING', message, data));
  }
};

