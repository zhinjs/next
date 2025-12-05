/**
 * 服务基类
 * 提供统一的服务生命周期管理
 */

export abstract class Service {
  /**
   * 服务名称
   */
  abstract readonly name: string;

  /**
   * 服务是否已初始化
   */
  protected _initialized = false;

  /**
   * 服务是否已销毁
   */
  protected _disposed = false;

  get initialized(): boolean {
    return this._initialized;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * 初始化服务
   * 子类可以重写此方法来实现自定义初始化逻辑
   */
  async start(): Promise<void> {
    if (this._initialized) {
      throw new Error(`Service "${this.name}" already initialized`);
    }
    if (this._disposed) {
      throw new Error(`Service "${this.name}" already disposed`);
    }
    this._initialized = true;
  }

  /**
   * 销毁服务
   * 子类可以重写此方法来实现自定义清理逻辑
   */
  async stop(): Promise<void> {
    if (this._disposed) {
      throw new Error(`Service "${this.name}" already disposed`);
    }
    if (!this._initialized) {
      throw new Error(`Service "${this.name}" not initialized`);
    }
    this._disposed = true;
    this._initialized = false;
  }

  /**
   * 确保服务已初始化
   */
  protected ensureInitialized(): void {
    if (this._disposed) {
      throw new Error(`Service "${this.name}" already disposed`);
    }
    if (!this._initialized) {
      throw new Error(
        `Service "${this.name}" not initialized. Call start() first.`
      );
    }
  }
}
