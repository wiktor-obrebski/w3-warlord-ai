export { LOG_LEVELS, type LogLevelName };

/** Pino's numeric levels; `silent` disables every level. */
const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity,
} as const;

type LogLevelName = keyof typeof LOG_LEVELS;
