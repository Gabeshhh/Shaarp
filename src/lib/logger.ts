type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function log(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ctx: context,
    msg: message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info:  (ctx: string, msg: string, meta?: Record<string, unknown>) => log('INFO',  ctx, msg, meta),
  warn:  (ctx: string, msg: string, meta?: Record<string, unknown>) => log('WARN',  ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: Record<string, unknown>) => log('ERROR', ctx, msg, meta),
};
