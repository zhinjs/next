/**
 * 框架基础错误类
 */
export class ZhinError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "ZhinError";
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * 适配器相关错误
 */
export class AdapterError extends ZhinError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, details);
    this.name = "AdapterError";
  }
}

/**
 * 插件相关错误
 */
export class PluginError extends ZhinError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, details);
    this.name = "PluginError";
  }
}

/**
 * 配置相关错误
 */
export class ConfigError extends ZhinError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, details);
    this.name = "ConfigError";
  }
}

/**
 * 账号相关错误
 */
export class AccountError extends ZhinError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, details);
    this.name = "AccountError";
  }
}

/**
 * 中间件相关错误
 */
export class MiddlewareError extends ZhinError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, details);
    this.name = "MiddlewareError";
  }
}

/**
 * 错误代码常量
 */
export const ErrorCode = {
  // 适配器错误
  ADAPTER_NOT_BOUND: "ADAPTER_NOT_BOUND",
  ADAPTER_NOT_FOUND: "ADAPTER_NOT_FOUND",
  ADAPTER_ALREADY_EXISTS: "ADAPTER_ALREADY_EXISTS",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  ACCOUNT_START_FAILED: "ACCOUNT_START_FAILED",
  ACCOUNT_STOP_FAILED: "ACCOUNT_STOP_FAILED",

  // 插件错误
  PLUGIN_NOT_FOUND: "PLUGIN_NOT_FOUND",
  PLUGIN_LOAD_FAILED: "PLUGIN_LOAD_FAILED",
  PLUGIN_ALREADY_LOADED: "PLUGIN_ALREADY_LOADED",
  PLUGIN_IMPORT_FAILED: "PLUGIN_IMPORT_FAILED",

  // 配置错误
  CONFIG_INVALID_KEY: "CONFIG_INVALID_KEY",
  CONFIG_LOAD_FAILED: "CONFIG_LOAD_FAILED",
  CONFIG_SAVE_FAILED: "CONFIG_SAVE_FAILED",
  CONFIG_PARSE_FAILED: "CONFIG_PARSE_FAILED",

  // 中间件错误
  MIDDLEWARE_NEXT_CALLED_MULTIPLE: "MIDDLEWARE_NEXT_CALLED_MULTIPLE",
  MIDDLEWARE_EXECUTION_FAILED: "MIDDLEWARE_EXECUTION_FAILED",

  // 通用错误
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  OPERATION_FAILED: "OPERATION_FAILED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
} as const;

/**
 * 错误处理器类型
 */
export type ErrorHandler = (
  error: Error,
  context?: ErrorContext
) => void | Promise<void>;

/**
 * 错误上下文
 */
export interface ErrorContext {
  source?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * 全局错误处理器管理
 */
export class ErrorManager {
  private static handlers: ErrorHandler[] = [];

  /**
   * 注册错误处理器
   */
  static onError(handler: ErrorHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) this.handlers.splice(index, 1);
    };
  }

  /**
   * 触发错误处理
   */
  static async handle(error: Error, context?: ErrorContext): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(error, context);
      } catch (err) {
        console.error("Error handler failed:", err);
      }
    }
  }

  /**
   * 清除所有处理器
   */
  static clear(): void {
    this.handlers = [];
  }

  /**
   * 包装异步函数，自动处理错误
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: ErrorContext
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handle(error as Error, context);
        throw error;
      }
    }) as T;
  }

  /**
   * 包装同步函数，自动处理错误
   */
  static wrapSync<T extends (...args: any[]) => any>(
    fn: T,
    context?: ErrorContext
  ): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handle(error as Error, context);
        throw error;
      }
    }) as T;
  }
}

/**
 * 创建错误工厂函数
 */
export function createError(
  ErrorClass: typeof ZhinError,
  code: string,
  message: string,
  details?: Record<string, any>
): ZhinError {
  return new ErrorClass(message, code, details);
}

/**
 * 判断是否为 Zhin 框架错误
 */
export function isZhinError(error: unknown): error is ZhinError {
  return error instanceof ZhinError;
}

/**
 * 格式化错误信息
 */
export function formatError(error: Error): string {
  if (isZhinError(error)) {
    const parts = [`[${error.name}]`, `[${error.code}]`, error.message];
    if (error.details) {
      parts.push(JSON.stringify(error.details, null, 2));
    }
    return parts.join(" ");
  }
  return `[${error.name}] ${error.message}`;
}
