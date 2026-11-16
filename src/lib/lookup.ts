// Resolve a barcode to a food: this device first, then Open Food Facts, then USDA.

import { findByBarcode, rememberFood } from './db';
import type { Food } from './nutrition';
import { fetchProduct, LookupError } from './off';
import { fetchUsdaBarcode } from './usda';

export interface LookupResult {
  food: Food;
  from: 'device' | 'off' | 'usda';
}

export async function lookupBarcode(code: string, usdaKey: string, signal?: AbortSignal): Promise<LookupResult | null> {
  const local = await findByBarcode(code);
  // A cached copy without calories is worth re-fetching in case the record has since been completed.
  if (local && !local.incomplete) return { food: local, from: 'device' };

  let offError: unknown;
  let found: LookupResult | null = null;
  try {
    const food = await fetchProduct(code, signal);
    if (food) found = { food, from: 'off' };
  } catch (e) {
    offError = e;
  }

  if ((!found || found.food.incomplete) && usdaKey) {
    try {
      const food = await fetchUsdaBarcode(code, usdaKey, signal);
      if (food) found = { food, from: 'usda' };
    } catch (e) {
      if (!found && !offError) offError = e;
    }
  }

  if (found) {
    await rememberFood(found.food);
    return found;
  }
  if (local) return { food: local, from: 'device' };
  if (offError instanceof LookupError || (offError as any)?.name === 'AbortError') throw offError;
  return null;
}
