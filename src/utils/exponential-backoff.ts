/**
 * Utility function to introduce a delay using Promises.
 * @param {number} ms - The delay time in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @class ExponentialBackoffRetry
 * Implements an exponential backoff retry strategy for asynchronous functions.
 * This class allows configuring the number of retries, initial delay, and maximum delay.
 */
export class ExponentialBackoffRetry {
  /**
   * The maximum number of retry attempts.
   * @private
   * @type {number}
   */
  private readonly maxRetries: number;

  /**
   * The initial delay in milliseconds before the first retry.
   * @private
   * @type {number}
   */
  private readonly initialDelayMs: number;

  /**
   * The maximum delay in milliseconds between retries.
   * @private
   * @type {number}
   */
  private readonly maxDelayMs: number;

  /**
   * Creates an instance of ExponentialBackoffRetry.
   * @param {object} options - Configuration options for the retry strategy.
   * @param {number} [options.maxRetries=5] - The maximum number of retry attempts. Defaults to 5.
   * @param {number} [options.initialDelayMs=100] - The initial delay in milliseconds. Defaults to 100ms.
   * @param {number} [options.maxDelayMs=10000] - The maximum delay in milliseconds between retries. Defaults to 10000ms (10 seconds).
   */
  constructor({
    maxRetries = 5,
    initialDelayMs = 100,
    maxDelayMs = 10000,
  }: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  } = {}) {
    if (maxRetries < 0) {
      throw new Error('maxRetries must be non-negative.');
    }
    if (initialDelayMs <= 0) {
      throw new Error('initialDelayMs must be positive.');
    }
    if (maxDelayMs < initialDelayMs) {
      throw new Error('maxDelayMs must be greater than or equal to initialDelayMs.');
    }

    this.maxRetries = maxRetries;
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  /**
   * Executes an asynchronous function with the configured retry strategy.
   * It attempts to run the function and retries upon failure with exponential backoff delay.
   * @template T The expected return type of the asynchronous function.
   * @param {() => Promise<T>} fn - The asynchronous function to execute and potentially retry.
   * @returns {Promise<T>} A promise that resolves with the result of the function if successful,
   *                      or rejects with the last error encountered after all retries are exhausted.
   * @throws {Error} Throws the last encountered error if all retry attempts fail.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Attempt to execute the function
        return await fn();
      } catch (error) {
        // Store the error in case this is the last attempt
        lastError = error instanceof Error ? error : new Error(String(error));

        // If it's the last attempt, break the loop and throw the error
        if (attempt === this.maxRetries) {
          break;
        }

        // Calculate the delay for the next retry
        // Delay = min(maxDelay, initialDelay * 2 ^ attempt)
        const delayTime = Math.min(
          this.maxDelayMs,
          this.initialDelayMs * Math.pow(2, attempt)
        );

        // Wait for the calculated delay
        console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delayTime}ms...`);
        await delay(delayTime);
      }
    }

    // If the loop finishes without returning, it means all retries failed.
    console.error(`All ${this.maxRetries + 1} attempts failed. Last error: ${lastError?.message}`);
    throw lastError; // Throw the last recorded error
  }
}
