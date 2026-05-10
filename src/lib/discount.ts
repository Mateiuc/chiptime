import type { Vehicle } from '@/types';

/**
 * Applies the per-vehicle labor discount to a labor amount.
 * - 'percent': value is 0-100, discount = ceil(labor * value / 100)
 * - 'fixed':   value is a dollar amount, capped at the labor amount
 * Returns { discount, laborAfter } where laborAfter is never negative.
 *
 * Discount is applied per-task (caller passes the task's labor).
 * Parts are not discounted.
 */
export function applyLaborDiscount(
  labor: number,
  vehicle?: Vehicle | null
): { discount: number; laborAfter: number } {
  if (
    !vehicle ||
    !vehicle.discountType ||
    !vehicle.discountValue ||
    vehicle.discountValue <= 0 ||
    labor <= 0
  ) {
    return { discount: 0, laborAfter: labor };
  }
  let discount = 0;
  if (vehicle.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, vehicle.discountValue));
    discount = Math.ceil((labor * pct) / 100);
  } else {
    discount = vehicle.discountValue;
  }
  discount = Math.min(discount, labor);
  return { discount, laborAfter: labor - discount };
}
