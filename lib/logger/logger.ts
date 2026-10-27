import { createLogger } from './core/create-logger';
import { parseBatchFile, parseBatchFileName } from './preload/batch-file';
import { createPreloadTransport } from './preload/preload-transport';
import type { Logger } from './core/create-logger';
import type { LogLevelName } from './core/levels';
import type { LogTransport } from './core/log-transport';
import type { PreloadNatives } from './preload/preload-transport';

export {
  createLogger,
  createPreloadTransport,
  parseBatchFile,
  parseBatchFileName,
  type Logger,
  type LogLevelName,
  type LogTransport,
  type PreloadNatives,
};
