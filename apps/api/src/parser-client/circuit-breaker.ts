export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureAt = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
  ) {}

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureAt >= this.resetMs) {
        this.state = CircuitState.HALF_OPEN;
      }
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === CircuitState.OPEN) {
      throw new Error('Parser circuit breaker is OPEN');
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures += 1;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
