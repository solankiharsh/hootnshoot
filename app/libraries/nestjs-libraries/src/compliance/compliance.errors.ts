export class ContentCopRateLimitError extends Error {
  constructor(message = 'Content Cop rate limit') {
    super(message);
    this.name = 'ContentCopRateLimitError';
  }
}

export class ContentCopBusyError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number, message = 'Content Cop busy') {
    super(message);
    this.name = 'ContentCopBusyError';
    this.retryAfter = retryAfter;
  }
}
