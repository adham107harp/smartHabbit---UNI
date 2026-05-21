/**
 * HTTP-aware error classes used across services.
 * Routes inspect `status` + `code` to send the right response.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export class HabitAlreadyLoggedError extends HttpError {
  constructor() {
    super('You already logged this habit today.', 409, 'HABIT_ALREADY_LOGGED');
    this.name = 'HabitAlreadyLoggedError';
  }
}

export class HabitAlreadyAtTargetError extends HttpError {
  constructor() {
    super("You've already hit today's target for this habit!", 409, 'HABIT_ALREADY_AT_TARGET');
    this.name = 'HabitAlreadyAtTargetError';
  }
}

export class AdminOnlyError extends HttpError {
  constructor() {
    super('This action requires admin privileges.', 403, 'ADMIN_ONLY');
    this.name = 'AdminOnlyError';
  }
}

export class HabitNotFoundError extends HttpError {
  constructor() {
    super('Habit not found.', 404, 'HABIT_NOT_FOUND');
    this.name = 'HabitNotFoundError';
  }
}

export class UndoWindowExpiredError extends HttpError {
  constructor() {
    super('Too late — this log is locked in.', 409, 'UNDO_WINDOW_EXPIRED');
    this.name = 'UndoWindowExpiredError';
  }
}

export class NoLogToUndoError extends HttpError {
  constructor() {
    super('There is nothing to undo.', 404, 'NO_LOG_TO_UNDO');
    this.name = 'NoLogToUndoError';
  }
}
