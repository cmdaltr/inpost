import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isTest
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  enabled: !isTest,
});

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}

export function setLogLevel(level: string) {
  logger.level = level;
}
