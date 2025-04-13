import { EventEmitter } from "./event-emitter";

export type Filter<T> = (item: T) => boolean;

export class Queue<T extends object | string | number> extends EventEmitter<{
  "item-added": { item: T, priority: number };
  "item-removed": { item: T };
}> {
  private items: { item: T, priority: number }[] = [];
  private filters: Filter<T>[] = [];

  private totalItems: number = 0;

  public addFilter(filter: Filter<T>) {
    this.filters.push(filter);
  }

  public removeFilter(filter: Filter<T>) {
    this.filters = this.filters.filter((f) => f !== filter);
  }

  public addItem(item: T, priority: number = 0) {
    // If the item is filtered out, don't add it to the queue
    if (this.filters.some((filter) => filter(item))) {
      return;
    }

    // Add the item to the queue
    this.items.push({ item, priority });
    this.totalItems++;

    this.emit("item-added", { item, priority });
  }

  // Remove an item from the queue
  public removeItem(item: T) {
    this.items = this.items.filter((i) => i !== item);
    this.emit("item-removed", { item });
  }

  // Get all items in the queue
  public getItems() {
    return this.items;
  }

  public hasItems() {
    return this.items.length > 0;
  }

  public nextItem() {
    // Sort the items by priority
    this.items.sort((a, b) => a.priority - b.priority);

    // Return the first item
    return this.items.shift();
  }

  public getTotalItems() {
    return this.totalItems;
  }
}
