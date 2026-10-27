import {
  isMathErrorCode,
  type BinaryOperation,
  type CalculationRequest,
  type CalculatorError,
  type ErrorKind,
  type MathErrorCode,
} from '../api/client'
import { messages } from '../messages'
import { formatNumber, roundResult, toDisplayMinus } from './format'

// DBL_DIG: a decimal with this many digits survives a round trip through float64.
const MAX_ENTRY_DIGITS = 15

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type Operand =
  | { kind: 'typed'; text: string }
  | { kind: 'computed'; value: number; label?: string }
  | null

interface Entry {
  operand: Operand
  accumulator: number | null
  operator: BinaryOperation | null
  lastExpression: string | null
}

type Completion =
  | { kind: 'operator'; operator: BinaryOperation }
  | { kind: 'equals'; expression: string }
  | { kind: 'squareRoot'; label: string }

export interface Pending {
  id: number
  request: CalculationRequest
  completion: Completion
  // Restored when the request fails for a reason that is not a math error.
  snapshot: Entry
}

export interface CalculatorState extends Entry {
  pending: Pending | null
  errorCode: MathErrorCode | null
  notice: ErrorKind | null
  // Survives clear, so a late response never matches a newer request.
  nextId: number
}

export type Action =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'operator'; operator: BinaryOperation }
  | { type: 'equals' }
  | { type: 'squareRoot' }

export type CalculatorEvent =
  | Action
  | { type: 'succeeded'; id: number; result: number }
  | { type: 'failed'; id: number; error: CalculatorError }

export interface CalculatorView {
  display: string
  expression: string
  status: 'ready' | 'computing' | 'error'
  notice: string | null
}

export const initialState: CalculatorState = {
  operand: { kind: 'typed', text: '0' },
  accumulator: null,
  operator: null,
  lastExpression: null,
  pending: null,
  errorCode: null,
  notice: null,
  nextId: 1,
}

export function reducer(
  state: CalculatorState,
  event: CalculatorEvent,
): CalculatorState {
  switch (event.type) {
    case 'succeeded':
      return state.pending?.id === event.id
        ? succeed(state, state.pending, roundResult(event.result))
        : state
    case 'failed':
      return state.pending?.id === event.id
        ? fail(state, state.pending, event.error)
        : state
    case 'clear':
      return fresh(state)
    default:
      if (state.pending) return state
      return apply(state.notice ? { ...state, notice: null } : state, event)
  }
}

function apply(
  state: CalculatorState,
  action: Exclude<Action, { type: 'clear' }>,
): CalculatorState {
  switch (action.type) {
    case 'digit':
      return enterDigit(state, action.digit)
    case 'decimal':
      return enterDecimal(state)
    case 'toggleSign':
      return toggleSign(state)
    case 'backspace':
      return backspace(state)
    case 'operator':
      return chooseOperator(state, action.operator)
    case 'equals':
      return equals(state)
    case 'squareRoot':
      return squareRoot(state)
  }
}

function fresh(state: CalculatorState): CalculatorState {
  return { ...initialState, nextId: state.nextId }
}

function typed(state: CalculatorState, text: string): CalculatorState {
  return {
    ...state,
    operand: { kind: 'typed', text },
    lastExpression: null,
    errorCode: null,
  }
}

function enterDigit(state: CalculatorState, digit: Digit): CalculatorState {
  const { operand } = state
  if (operand?.kind !== 'typed') return typed(state, digit)
  const { text } = operand
  if (text === '0') return typed(state, digit)
  if (text === '-0') return typed(state, `-${digit}`)
  return digitCount(text) < MAX_ENTRY_DIGITS
    ? typed(state, text + digit)
    : state
}

// The leading zero of "0." is not a digit of the number.
function digitCount(text: string): number {
  return (text.replace(/^-?0\./, '.').match(/\d/g) ?? []).length
}

function enterDecimal(state: CalculatorState): CalculatorState {
  const { operand } = state
  if (operand?.kind !== 'typed') return typed(state, '0.')
  return operand.text.includes('.') ? state : typed(state, `${operand.text}.`)
}

function toggleSign(state: CalculatorState): CalculatorState {
  const { operand } = state
  if (state.errorCode) return state
  if (operand === null) return typed(state, '-0')
  if (operand.kind === 'computed') {
    return {
      ...state,
      operand: { kind: 'computed', value: -operand.value },
      lastExpression: null,
    }
  }
  const { text } = operand
  return typed(state, text.startsWith('-') ? text.slice(1) : `-${text}`)
}

function backspace(state: CalculatorState): CalculatorState {
  if (state.errorCode) return fresh(state)
  const { operand } = state
  if (operand?.kind !== 'typed') return state
  const text = operand.text.slice(0, -1)
  return typed(state, text === '' || text === '-' ? '0' : text)
}

function chooseOperator(
  state: CalculatorState,
  operator: BinaryOperation,
): CalculatorState {
  const { operand, accumulator } = state
  if (state.errorCode) return state
  if (operand === null) return { ...state, operator }
  if (state.operator !== null && accumulator !== null) {
    return request(
      state,
      {
        operation: state.operator,
        a: accumulator,
        b: valueOf(operand),
      },
      { kind: 'operator', operator },
    )
  }
  return {
    ...state,
    accumulator: valueOf(operand),
    operator,
    operand: null,
    lastExpression: null,
  }
}

function equals(state: CalculatorState): CalculatorState {
  const { operand, accumulator, operator } = state
  if (operator === null || accumulator === null || operand === null) {
    return state
  }
  const b = valueOf(operand)
  const expression = `${formatNumber(accumulator)} ${messages.operatorSymbols[operator]} ${formatNumber(b)} =`
  return request(
    state,
    { operation: operator, a: accumulator, b },
    { kind: 'equals', expression },
  )
}

function squareRoot(state: CalculatorState): CalculatorState {
  if (state.operand === null) return state
  const a = valueOf(state.operand)
  return request(
    state,
    { operation: 'sqrt', a },
    { kind: 'squareRoot', label: `√(${formatNumber(a)})` },
  )
}

function request(
  state: CalculatorState,
  calculation: CalculationRequest,
  completion: Completion,
): CalculatorState {
  const { operand, accumulator, operator, lastExpression } = state
  return {
    ...state,
    pending: {
      id: state.nextId,
      request: calculation,
      completion,
      snapshot: { operand, accumulator, operator, lastExpression },
    },
    nextId: state.nextId + 1,
  }
}

function succeed(
  state: CalculatorState,
  { completion }: Pending,
  value: number,
): CalculatorState {
  const done = { ...state, pending: null }
  switch (completion.kind) {
    case 'operator':
      return {
        ...done,
        accumulator: value,
        operator: completion.operator,
        operand: null,
        lastExpression: null,
      }
    case 'equals':
      return {
        ...done,
        accumulator: null,
        operator: null,
        operand: { kind: 'computed', value },
        lastExpression: completion.expression,
      }
    case 'squareRoot':
      return {
        ...done,
        operand: { kind: 'computed', value, label: completion.label },
        lastExpression: null,
      }
  }
}

function fail(
  state: CalculatorState,
  { snapshot }: Pending,
  error: CalculatorError,
): CalculatorState {
  if (error.kind === 'math' && isMathErrorCode(error.code)) {
    return { ...fresh(state), operand: null, errorCode: error.code }
  }
  return { ...state, ...snapshot, pending: null, notice: error.kind }
}

function valueOf(operand: NonNullable<Operand>): number {
  return operand.kind === 'typed' ? Number(operand.text) : operand.value
}

export function selectView(state: CalculatorState): CalculatorView {
  return {
    display: displayOf(state),
    expression: expressionOf(state),
    status: state.pending ? 'computing' : state.errorCode ? 'error' : 'ready',
    notice: state.notice === null ? null : messages.notices[state.notice],
  }
}

function displayOf({
  errorCode,
  operand,
  accumulator,
}: CalculatorState): string {
  if (errorCode) return messages.mathErrors[errorCode]
  if (operand?.kind === 'typed') return toDisplayMinus(operand.text)
  if (operand?.kind === 'computed')
    return toDisplayMinus(formatNumber(operand.value))
  return accumulator === null ? '' : toDisplayMinus(formatNumber(accumulator))
}

function expressionOf(state: CalculatorState): string {
  const { errorCode, operand, accumulator, operator, lastExpression } = state
  if (errorCode) return messages.errorHint
  const label = operand?.kind === 'computed' ? operand.label : undefined
  if (operator !== null && accumulator !== null) {
    const left = `${formatNumber(accumulator)} ${messages.operatorSymbols[operator]}`
    return toDisplayMinus(label ? `${left} ${label}` : left)
  }
  return toDisplayMinus(lastExpression ?? label ?? '')
}
