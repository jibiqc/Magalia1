// Utility for conditional logging in development vs production
const isDev = import.meta.env.DEV;

export const log = {
  debug: (...args) => isDev && console.log(...args),
  info: (...args) => isDev && console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
