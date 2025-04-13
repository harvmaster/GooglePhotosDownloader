import { Queue } from './queue';

/**
 * Represents a function that performs an asynchronous task.
 * @returns {Promise<any>} A promise that resolves when the task is complete.
 */
export type ProcessItem = () => Promise<any>;

/**
 * Represents an item that can be processed by the ParallelProcessor.
 * @property {ProcessItem} process - The async function to execute.
 * @property {number} priority - The priority of the item (lower number means higher priority).
 * @property {(value: any) => void} resolve - The resolve function of the promise associated with this item.
 * @property {(reason?: any) => void} reject - The reject function of the promise associated with this item.
 */
export type Processable<T = any> = {
  process: ProcessItem;
  priority: number;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
};

/**
 * Manages a queue of asynchronous tasks and processes them in parallel
 * up to a specified concurrency limit, respecting priority.
 */
export class ParallelProcessor {
  /** @private The queue of items waiting to be processed, managed by Queue class. */
  private queue: Queue<Processable> = new Queue<Processable>();

  /** @private The maximum number of items that can be processed concurrently. */
  private maxConcurrency: number;

  /** @private The items currently being processed. */
  private executing: Array<Processable> = [];

  /**
   * Creates an instance of ParallelProcessor.
   * @param {number} [maxConcurrency=10] - The maximum number of tasks to run in parallel.
   */
  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;

    // Listen for new items added to the queue
    this.queue.on('item-added', () => {
      setImmediate(() => this.execute());
    });
  }

  /**
   * Adds an asynchronous task to the processing queue.
   * @template T The type of the value the process item's promise resolves with.
   * @param {() => Promise<T>} item - The asynchronous function (task) to execute.
   * @param {number} [priority=0] - The priority of the task (lower number means higher priority).
   * @returns {Promise<T>} A promise that resolves or rejects with the result of the task.
   */
  public process<T>(item: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const processable: Processable<T> = { process: item, priority, resolve, reject };
      this.queue.addItem(processable, priority);
    });
  }

  /**
   * @private Executes the next highest priority item from the queue if concurrency limit allows.
   * This method is called internally whenever a task completes or a new task is added.
   */
  private async execute() {
    while (this.executing.length < this.maxConcurrency && this.queue.hasItems()) {
      const next = this.queue.nextItem();
      if (!next) break;

      const item = next.item;
      this.executing.push(item);
      this.runItem(item);
    }
  }

  /**
   * @private Runs a single processable item and handles its completion or failure.
   * @param {Processable} item - The item to run.
   */
  private async runItem(item: Processable) {
    try {
      const result = await item.process();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      const index = this.executing.indexOf(item);
      if (index > -1) {
        this.executing.splice(index, 1);
      }
      this.execute();
    }
  }
}
