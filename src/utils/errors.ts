export class InPostError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'InPostError';
  }
}

export class NotionError extends InPostError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'NotionError';
  }
}

export class LinkedInError extends InPostError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'LinkedInError';
  }
}

export class LinkedInAuthError extends LinkedInError {
  constructor(message: string, cause?: Error) {
    super(message, 'LINKEDIN_AUTH_ERROR', cause);
    this.name = 'LinkedInAuthError';
  }
}

export class AIError extends InPostError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'AIError';
  }
}

export class ConfigError extends InPostError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends InPostError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}
