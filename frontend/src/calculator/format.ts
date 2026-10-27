// 15 significant digits is float64's guaranteed decimal precision (DBL_DIG).
const SIGNIFICANT_DIGITS = 15

export function roundResult(value: number): number {
  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS))
  // Number.MAX_VALUE rounds up past the largest float64.
  return Number.isFinite(rounded) ? rounded : value
}

export function formatNumber(value: number): string {
  return String(roundResult(value))
}
