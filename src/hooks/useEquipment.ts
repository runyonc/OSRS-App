import { useEffect, useState } from 'react';
import { loadEquipment, type EquipmentModule } from '../lib/equipmentLazy';

let cached: EquipmentModule | null = null;

/** The lazily loaded equipment module, or null until it arrives. */
export function useEquipment(): EquipmentModule | null {
  const [mod, setMod] = useState<EquipmentModule | null>(cached);
  useEffect(() => {
    if (mod) return;
    let alive = true;
    loadEquipment().then((m) => { cached = m; if (alive) setMod(m); }).catch(() => undefined);
    return () => { alive = false; };
  }, [mod]);
  return mod;
}
