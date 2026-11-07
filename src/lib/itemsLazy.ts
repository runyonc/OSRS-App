/** The item database is ~250 KB, so it loads on first use instead of with the app. */
export type ItemsModule = typeof import('./items');
let promise: Promise<ItemsModule> | null = null;
export function loadItems(): Promise<ItemsModule> {
  if (!promise) promise = import('./items');
  return promise;
}
