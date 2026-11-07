import { useEquipment } from '../hooks/useEquipment';

/** An item's inventory icon from the bundled sprite sheet; renders nothing until the database has loaded. */
export default function ItemIcon({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  const eq = useEquipment();
  const style = eq ? eq.spriteStyle(name, size) : undefined;
  if (!style) return <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden />;
  return <span className={`inline-block shrink-0 ${className}`} style={style} title={name} role="img" aria-label={name} />;
}
