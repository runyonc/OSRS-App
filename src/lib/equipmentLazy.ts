/** The equipment database is ~0.5 MB, so it loads on first use instead of with the app. */
export type EquipmentModule = typeof import('./equipment');
let promise: Promise<EquipmentModule> | null = null;
export function loadEquipment(): Promise<EquipmentModule> {
  if (!promise) promise = import('./equipment');
  return promise;
}
