import { describe, expect, it } from 'vitest'
import { formatNumber, roundResult, toDisplayMinus } from './format'

describe('formatNumber', () => {
  it.each([
    [0.30000000000000004, '0.3'],
    [5, '5'],
    [-0, '0'],
    [1 / 3, '0.333333333333333'],
    [2 / 3, '0.666666666666667'],
    [-2.5, '-2.5'],
    [1e21, '1e+21'],
    [1e-6, '0.000001'],
    [1e-7, '1e-7'],
    [123456789012345680, '123456789012346000'],
    [Number.MAX_VALUE, '1.7976931348623157e+308'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})

describe('toDisplayMinus', () => {
  it.each([
    ['-12', '−12'],
    ['1.2e-8', '1.2e−8'],
    ['5', '5'],
  ])('shows %s as %s', (text, expected) => {
    expect(toDisplayMinus(text)).toBe(expected)
  })
})

describe('roundResult', () => {
  it('rounds float64 noise away', () => {
    expect(roundResult(0.30000000000000004)).toBe(0.3)
  })

  it('returns the value unchanged when rounding would leave the float64 range', () => {
    expect(roundResult(Number.MAX_VALUE)).toBe(Number.MAX_VALUE)
  })
})
