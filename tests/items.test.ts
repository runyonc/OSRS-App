import { describe, it, expect } from 'vitest';
import { ALL_ITEMS, EQUIPMENT, searchItems, slotItems, isKnownItem } from '../src/lib/items';

describe('item database', () => {
  it('bundles the full item list and every equipment slot', () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(10000);
    for (const slot of ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring']) {
      expect(EQUIPMENT[slot]?.length, slot).toBeGreaterThan(50);
    }
    expect(slotItems('weapon')).toContain('Abyssal whip');
    expect(slotItems('cape')).toContain('Fire cape');
    expect(slotItems('legs')).toContain('Bandos tassets');
    expect(isKnownItem("Ava's accumulator")).toBe(true);
    expect(isKnownItem('Not a real item')).toBe(false);
  });

  it('ranks exact and prefix matches first', () => {
    expect(searchItems('abyssal whip')[0]).toBe('Abyssal whip');
    expect(searchItems('dragon scim')[0]).toBe('Dragon scimitar');
    expect(searchItems('whip', slotItems('weapon'))).toContain('Abyssal whip');
    expect(searchItems('a')).toEqual([]);
    expect(searchItems('fire cape', slotItems('cape'))[0]).toBe('Fire cape');
  });
});
