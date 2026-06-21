/**
 * Server logging boundary. All server-side diagnostics go through here so log
 * output stays consistent and the codebase has one approved console sink.
 *
 * Never pass session replay payloads, secrets, tokens, cookies, or request
 * headers to these functions. Logs are for operational diagnostics only.
 */

type Level = 'info' | 'warn' | 'error';

const PREFIX = '[TinyReplay]';

function write(level: Level, line: string): void {
  // The one place the server is allowed to touch the console.
  /* eslint-disable no-console -- approved logging sink */
  const sinks: Record<Level, (msg: string) => void> = {
    info: console.log,
    warn: console.warn,
    error: console.error,
  };
  /* eslint-enable no-console */
  sinks[level](`${PREFIX} ${line}`);
}

function format(message: string, fields?: Record<string, unknown>): string {
  if (!fields) return message;
  return `${message} ${JSON.stringify(fields)}`;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? `${err.name}: ${err.message}`;
  return String(err);
}

export const log = {
  info(message: string, fields?: Record<string, unknown>): void {
    write('info', format(message, fields));
  },
  warn(message: string, fields?: Record<string, unknown>): void {
    write('warn', format(message, fields));
  },
  error(message: string, err?: unknown): void {
    write('error', err === undefined ? message : `${message}: ${describeError(err)}`);
  },
};
