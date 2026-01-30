// Error boundary utilities - safe error handling that never throws

export function safeNumber(value: any, defaultValue: number = 0): number {
  try {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
  } catch {
    return defaultValue;
  }
}

export function safeString(value: any, defaultValue: string = ''): string {
  try {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    return String(value);
  } catch {
    return defaultValue;
  }
}

export function safeArray<T>(value: any, defaultValue: T[] = []): T[] {
  try {
    if (!value) {
      return defaultValue;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeObject<T>(value: any, defaultValue: T | null = null): T | null {
  try {
    if (!value || typeof value !== 'object') {
      return defaultValue;
    }
    return value as T;
  } catch {
    return defaultValue;
  }
}

export function safeDate(value: any, defaultValue: Date | null = null): Date | null {
  try {
    if (!value) {
      return defaultValue;
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeExecute<T>(
  fn: () => T,
  defaultValue: T,
  errorHandler?: (error: Error) => void
): T {
  try {
    return fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error instanceof Error ? error : new Error(String(error)));
    }
    return defaultValue;
  }
}

export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  errorHandler?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error instanceof Error ? error : new Error(String(error)));
    }
    return defaultValue;
  }
}
