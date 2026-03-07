import pino from 'pino';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export type Logger = pino.Logger;

export function setupLogging(logDir: string = './logs'): Logger {
  const logPath = join(logDir);
  
  if (!existsSync(logPath)) {
    mkdirSync(logPath, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const logFile = join(logPath, `scraper-${date}.log`);

  const logger = pino({
    level: 'info',
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: logFile },
          level: 'debug',
        },
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'iso',
            ignore: 'pid,hostname',
          },
          level: 'info',
        },
      ],
    },
  });

  return logger;
}

export const logger = setupLogging();
