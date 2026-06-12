type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

type LogContext = Record<string, unknown>;

type LoggerDefaults = {
  service: string;
  component?: string;
  source?: string;
};

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
  route?: { path?: string };
};

type ResponseLike = {
  statusCode?: number;
  getHeader?: (name: string) => number | string | string[] | undefined;
  on?: (event: string, listener: () => void) => void;
};

type NextFunction = () => void;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|secret|token|authorization|cookie|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|signing[-_]?key|dsn)/i;

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(sk|pk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{12,}\b/g,
];

const redactString = (value: string) =>
  SECRET_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[REDACTED]'),
    value
  );

const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 4) {
    return '[TRUNCATED]';
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
    ])
  );
};

const serializeError = (error: Error) => ({
  'error.kind': error.name || 'Error',
  'error.message': redactString(error.message),
  'error.stack_top': error.stack?.split('\n').slice(0, 2).join('\n'),
});

const requestPath = (req: RequestLike) => {
  const rawPath = req.originalUrl || req.url || req.path || '';

  try {
    return new URL(rawPath, 'http://localhost').pathname;
  } catch {
    return rawPath.split('?')[0];
  }
};

const baseRecord = ({ service, component, source }: LoggerDefaults) => {
  const env = process.env.DD_ENV || process.env.NODE_ENV || 'development';
  const version = process.env.DD_VERSION || process.env.NEXT_PUBLIC_VERSION;

  return {
    timestamp: new Date().toISOString(),
    service,
    component,
    env,
    version,
    tags: [`service:${service}`, `env:${env}`, ...(version ? [`version:${version}`] : [])],
    'dd.service': service,
    'dd.source': source || 'nodejs',
    'dd.env': env,
    'dd.version': version,
  };
};

export const createDatadogLogger = (defaults: LoggerDefaults) => {
  const write = (level: LogLevel, message: string, context: LogContext = {}) => {
    const { error, ...restContext } = context;
    const errorContext = error instanceof Error ? serializeError(error) : {};
    const record = sanitize({
      ...baseRecord(defaults),
      level,
      message,
      ...restContext,
      ...errorContext,
    });
    const output = JSON.stringify(record);

    if (level === 'error' || level === 'fatal') {
      console.error(output);
      return;
    }

    console.log(output);
  };

  return {
    debug: (message: string, context?: LogContext) =>
      write('debug', message, context),
    info: (message: string, context?: LogContext) =>
      write('info', message, context),
    warn: (message: string, context?: LogContext) =>
      write('warn', message, context),
    error: (message: string, context?: LogContext) =>
      write('error', message, context),
    fatal: (message: string, context?: LogContext) =>
      write('fatal', message, context),
  };
};

export const createDatadogRequestLogger = (defaults: LoggerDefaults) => {
  const logger = createDatadogLogger({
    ...defaults,
    component: defaults.component || 'http',
  });

  return (req: RequestLike, res: ResponseLike, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    const requestId =
      req.headers?.['x-request-id'] ||
      req.headers?.['x-correlation-id'] ||
      res.getHeader?.('x-request-id');

    res.on?.('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const statusCode = res.statusCode || 0;
      const level: LogLevel =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      logger[level]('HTTP request completed', {
        event: 'hootnshoot.http.request.completed',
        'http.method': req.method,
        'http.route': req.route?.path,
        'http.path': requestPath(req),
        'http.status_code': statusCode,
        'duration_ms': Math.round(durationMs),
        'request.id': Array.isArray(requestId) ? requestId[0] : requestId,
      });
    });

    next();
  };
};
