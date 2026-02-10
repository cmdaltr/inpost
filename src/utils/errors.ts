export class PostForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PostForgeError';
  }
}

export class NotionError extends PostForgeError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'NotionError';
  }
}

export class LinkedInError extends PostForgeError {
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

export class AIError extends PostForgeError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'AIError';
  }
}

export class ConfigError extends PostForgeError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends PostForgeError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}
