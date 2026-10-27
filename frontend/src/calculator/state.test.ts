import { describe, expect, it } from 'vitest'
import { CalculatorError, type BinaryOperation } from '../api/client'
import { messages } from '../messages'
import {
  initialState,
  reducer,
  selectView,
  type Action,
  type CalculatorEvent,
  type CalculatorState,
  type Digit,
} from './state'

const digits = (text: string): Action[] =>
  [...text].map((char) =>
    char === '.'
      ? { type: 'decimal' }
      : { type: 'digit', digit: char as Digit },
  )
const operator = (name: BinaryOperation): Action => ({
  type: 'operator',
  operator: name,
})
const equals: Action = { type: 'equals' }
const clear: Action = { type: 'clear' }
const squareRoot: Action = { type: 'squareRoot' }
const toggleSign: Action = { type: 'toggleSign' }
const backspace: Action = { type: 'backspace' }

function run(
  events: (CalculatorEvent | CalculatorEvent[])[],
  from: CalculatorState = initialState,
): CalculatorState {
  return events.flat().reduce(reducer, from)
}

function pendingOf(state: CalculatorState) {
  if (!state.pending) throw new Error('expected a request in flight')
  return state.pending
}

function succeed(state: CalculatorState, result: number): CalculatorState {
  return reducer(state, {
    type: 'succeeded',
    id: pendingOf(state).id,
    result,
  })
}

function fail(state: CalculatorState, error: CalculatorError): CalculatorState {
  return reducer(state, { type: 'failed', id: pendingOf(state).id, error })
}

const divisionByZero = new CalculatorError(
  'math',
  'division by zero is undefined',
  {
    code: 'division_by_zero',
    status: 422,
  },
)
const unreachable = new CalculatorError('network', 'the service is unreachable')

function showing(state: CalculatorState) {
  const { display, expression } = selectView(state)
  return { display, expression }
}

describe('initial state', () => {
  it('shows 0 with an empty expression line', () => {
    expect(selectView(initialState)).toEqual({
      display: '0',
      expression: '',
      status: 'ready',
      notice: null,
    })
  })
})

describe('evaluation', () => {
  it('computes 12 + 7 = through one request', () => {
    const waiting = run([digits('12'), operator('add'), digits('7'), equals])

    expect(pendingOf(waiting).request).toEqual({
      operation: 'add',
      a: 12,
      b: 7,
    })
    expect(selectView(waiting).status).toBe('computing')

    const done = succeed(waiting, 19)
    expect(showing(done)).toEqual({ display: '19', expression: '12 + 7 =' })
    expect(selectView(done).status).toBe('ready')
  })

  it('evaluates left to right: 2 + 3 x requests add first, then shows 5 x', () => {
    const waiting = run([
      digits('2'),
      operator('add'),
      digits('3'),
      operator('multiply'),
    ])

    expect(pendingOf(waiting).request).toEqual({ operation: 'add', a: 2, b: 3 })

    const chained = succeed(waiting, 5)
    expect(showing(chained)).toEqual({ display: '5', expression: '5 ×' })

    const next = run([digits('4'), equals], chained)
    expect(pendingOf(next).request).toEqual({
      operation: 'multiply',
      a: 5,
      b: 4,
    })
  })

  it('shows the running operator while the second operand is typed', () => {
    const state = run([digits('12'), operator('multiply'), digits('4')])

    expect(showing(state)).toEqual({ display: '4', expression: '12 ×' })
  })

  it('replaces the operator when another is chosen before a second operand', () => {
    const replaced = run([digits('2'), operator('add'), operator('multiply')])

    expect(showing(replaced)).toEqual({ display: '2', expression: '2 ×' })
    expect(replaced.pending).toBeNull()

    const waiting = run([digits('3'), equals], replaced)
    expect(pendingOf(waiting).request).toEqual({
      operation: 'multiply',
      a: 2,
      b: 3,
    })
  })

  it('reads 15 % of 80 = as a percentage request', () => {
    const waiting = run([
      digits('15'),
      operator('percentage'),
      digits('80'),
      equals,
    ])

    expect(pendingOf(waiting).request).toEqual({
      operation: 'percentage',
      a: 15,
      b: 80,
    })
    expect(showing(succeed(waiting, 12)).expression).toBe('15 % of 80 =')
  })

  it('continues from a result when an operator follows =', () => {
    const done = succeed(
      run([digits('12'), operator('add'), digits('7'), equals]),
      19,
    )

    expect(showing(run([operator('multiply')], done))).toEqual({
      display: '19',
      expression: '19 ×',
    })
  })

  it('starts a fresh calculation when a digit follows =', () => {
    const done = succeed(
      run([digits('12'), operator('add'), digits('7'), equals]),
      19,
    )
    const fresh = run([digits('4')], done)

    expect(showing(fresh)).toEqual({ display: '4', expression: '' })
    expect(run([equals], fresh)).toBe(fresh)
  })

  it('ignores = without a pending operator', () => {
    const state = run([digits('5')])

    expect(run([equals], state)).toBe(state)
  })

  it('stores the rounded result so the next request sends what is shown', () => {
    const sum = succeed(
      run([digits('0.1'), operator('add'), digits('0.2'), equals]),
      0.30000000000000004,
    )
    expect(showing(sum).display).toBe('0.3')

    const next = run([operator('subtract'), digits('0.3'), equals], sum)
    expect(pendingOf(next).request).toEqual({
      operation: 'subtract',
      a: 0.3,
      b: 0.3,
    })
  })
})

describe('entering digits', () => {
  it('replaces the initial 0 and appends after it', () => {
    expect(showing(run([digits('0')])).display).toBe('0')
    expect(showing(run([digits('007')])).display).toBe('7')
    expect(showing(run([digits('120')])).display).toBe('120')
  })

  it('stops accepting digits at 15', () => {
    const full = run([digits('1'.repeat(15))])

    expect(showing(full).display).toBe('1'.repeat(15))
    expect(run([digits('2')], full)).toBe(full)
  })

  it('counts digits after the decimal point but not the zero of "0."', () => {
    const full = run([digits('.123456789012345')])

    expect(showing(full).display).toBe('0.123456789012345')
    expect(run([digits('6')], full)).toBe(full)
  })

  it('does not count the sign towards the cap', () => {
    const full = run([toggleSign, digits('9'.repeat(15))])

    expect(showing(full).display).toBe(`-${'9'.repeat(15)}`)
    expect(run([digits('9')], full)).toBe(full)
  })

  it('still accepts a decimal point at the cap', () => {
    const full = run([digits('1'.repeat(15))])

    expect(showing(run([digits('.')], full)).display).toBe(`${'1'.repeat(15)}.`)
  })
})

describe('decimal point', () => {
  it('starts "0." on a fresh entry', () => {
    expect(showing(run([digits('.')])).display).toBe('0.')
  })

  it('is ignored when the entry already has one', () => {
    expect(showing(run([digits('1.5.')])).display).toBe('1.5')
  })

  it('starts "0." after an operator', () => {
    const state = run([digits('2'), operator('add'), digits('.5')])

    expect(showing(state).display).toBe('0.5')
  })

  it('starts "0." after a result', () => {
    const done = succeed(
      run([digits('2'), operator('add'), digits('3'), equals]),
      5,
    )

    expect(showing(run([digits('.')], done)).display).toBe('0.')
  })

  it('sends a trailing point as the plain number', () => {
    const waiting = run([digits('5.'), operator('add'), digits('1'), equals])

    expect(pendingOf(waiting).request).toEqual({ operation: 'add', a: 5, b: 1 })
  })
})

describe('toggle sign', () => {
  it('flips the sign of a typed entry', () => {
    expect(showing(run([digits('5'), toggleSign])).display).toBe('-5')
    expect(showing(run([digits('5'), toggleSign, toggleSign])).display).toBe(
      '5',
    )
  })

  it('turns 0 into -0 and keeps typing negative', () => {
    expect(showing(run([toggleSign])).display).toBe('-0')
    expect(showing(run([toggleSign, digits('5')])).display).toBe('-5')
  })

  it('negates a computed value and drops its label', () => {
    const root = succeed(run([digits('16'), squareRoot]), 4)
    expect(showing(root).expression).toBe('√(16)')

    expect(showing(run([toggleSign], root))).toEqual({
      display: '-4',
      expression: '',
    })
  })

  it('clears the expression of a result it negates', () => {
    const done = succeed(
      run([digits('2'), operator('add'), digits('3'), equals]),
      5,
    )

    expect(showing(run([toggleSign], done))).toEqual({
      display: '-5',
      expression: '',
    })
  })

  it('starts a negative entry right after an operator', () => {
    const state = run([digits('5'), operator('add'), toggleSign])
    expect(showing(state).display).toBe('-0')

    const waiting = run([digits('3'), equals], state)
    expect(pendingOf(waiting).request).toEqual({
      operation: 'add',
      a: 5,
      b: -3,
    })
  })
})

describe('backspace', () => {
  it('drops the last character', () => {
    expect(showing(run([digits('123'), backspace])).display).toBe('12')
    expect(showing(run([digits('1.5'), backspace, backspace])).display).toBe(
      '1',
    )
  })

  it('falls back to 0 when nothing is left', () => {
    expect(showing(run([digits('5'), backspace])).display).toBe('0')
    expect(showing(run([digits('5'), toggleSign, backspace])).display).toBe('0')
    expect(showing(run([backspace])).display).toBe('0')
  })

  it('ignores a computed value and an empty operand', () => {
    const done = succeed(
      run([digits('2'), operator('add'), digits('3'), equals]),
      5,
    )
    expect(run([backspace], done)).toBe(done)

    const afterOperator = run([digits('2'), operator('add')])
    expect(run([backspace], afterOperator)).toBe(afterOperator)
  })
})

describe('square root', () => {
  it('requests sqrt of the entry and labels the result', () => {
    const waiting = run([digits('16'), squareRoot])

    expect(pendingOf(waiting).request).toEqual({ operation: 'sqrt', a: 16 })
    expect(showing(succeed(waiting, 4))).toEqual({
      display: '4',
      expression: '√(16)',
    })
  })

  it('keeps a pending operator and shows it with the label', () => {
    const root = succeed(
      run([digits('9'), operator('add'), digits('16'), squareRoot]),
      4,
    )

    expect(showing(root)).toEqual({ display: '4', expression: '9 + √(16)' })

    const waiting = run([equals], root)
    expect(pendingOf(waiting).request).toEqual({ operation: 'add', a: 9, b: 4 })
  })

  it('is ignored right after an operator', () => {
    const state = run([digits('9'), operator('add')])

    expect(run([squareRoot], state)).toBe(state)
  })
})

describe('clear', () => {
  it('resets everything', () => {
    const state = run([digits('9'), operator('add'), digits('1'), clear])

    expect(state).toEqual(initialState)
  })

  it('ignores a late success of the request it dropped', () => {
    const waiting = run([digits('1'), operator('add'), digits('2'), equals])
    const cleared = run([clear], waiting)

    expect(cleared.pending).toBeNull()
    expect(showing(cleared)).toEqual({ display: '0', expression: '' })

    const late = reducer(cleared, {
      type: 'succeeded',
      id: pendingOf(waiting).id,
      result: 3,
    })
    expect(late).toBe(cleared)
  })

  it('does not let a late response match a newer request', () => {
    const first = run([digits('1'), operator('add'), digits('2'), equals])
    const second = run(
      [clear, digits('1'), operator('add'), digits('2'), equals],
      first,
    )

    expect(pendingOf(second).id).not.toBe(pendingOf(first).id)
    expect(
      reducer(second, {
        type: 'succeeded',
        id: pendingOf(first).id,
        result: 99,
      }),
    ).toBe(second)
  })
})

describe('while computing', () => {
  const waiting = run([digits('1'), operator('add'), digits('2'), equals])

  it.each<[string, Action]>([
    ['a digit', { type: 'digit', digit: '5' }],
    ['a decimal point', { type: 'decimal' }],
    ['a sign toggle', toggleSign],
    ['a backspace', backspace],
    ['an operator', operator('multiply')],
    ['equals', equals],
    ['a square root', squareRoot],
  ])('ignores %s', (_name, action) => {
    expect(reducer(waiting, action)).toBe(waiting)
  })

  it('ignores a response with another id', () => {
    const stale = {
      type: 'succeeded',
      id: pendingOf(waiting).id + 1,
      result: 3,
    } as const

    expect(reducer(waiting, stale)).toBe(waiting)
    expect(
      reducer(waiting, { type: 'failed', id: stale.id, error: unreachable }),
    ).toBe(waiting)
  })
})

describe('math errors', () => {
  const errored = fail(
    run([digits('1'), operator('divide'), digits('0'), equals]),
    divisionByZero,
  )

  it('shows the catalog message and the hint, and clears the entry', () => {
    expect(showing(errored)).toEqual({
      display: messages.mathErrors.division_by_zero,
      expression: messages.errorHint,
    })
    expect(selectView(errored).status).toBe('error')
    expect(errored).toMatchObject({
      operand: null,
      accumulator: null,
      operator: null,
    })
  })

  it.each<[string, Action]>([
    ['an operator', operator('add')],
    ['equals', equals],
    ['a sign toggle', toggleSign],
    ['a square root', squareRoot],
  ])('ignores %s', (_name, action) => {
    expect(selectView(run([action], errored)).status).toBe('error')
  })

  it('starts over with a digit', () => {
    expect(selectView(run([digits('5')], errored))).toEqual({
      display: '5',
      expression: '',
      status: 'ready',
      notice: null,
    })
  })

  it('starts over with a decimal point', () => {
    expect(showing(run([digits('.')], errored)).display).toBe('0.')
  })

  it('resets on backspace', () => {
    expect(run([backspace], errored)).toEqual({
      ...initialState,
      nextId: errored.nextId,
    })
  })
})

describe('transport failures', () => {
  const waiting = run([digits('1'), operator('add'), digits('2'), equals])
  const failed = fail(waiting, unreachable)

  it('restores the state from before the request and sets a notice', () => {
    expect(failed).toMatchObject({
      operand: { kind: 'typed', text: '2' },
      accumulator: 1,
      operator: 'add',
      pending: null,
      notice: 'network',
    })
    expect(selectView(failed).notice).toBe(messages.notices.network)
    expect(showing(failed)).toEqual({ display: '2', expression: '1 +' })
  })

  it('re-requests when the same key is pressed again', () => {
    const retry = run([equals], failed)

    expect(pendingOf(retry).request).toEqual(pendingOf(waiting).request)
    expect(pendingOf(retry).id).not.toBe(pendingOf(waiting).id)
    expect(selectView(retry).notice).toBeNull()
  })

  it('clears the notice on the next event', () => {
    expect(selectView(run([digits('3')], failed)).notice).toBeNull()
  })

  it.each(['timeout', 'server', 'rejected', 'unreadable'] as const)(
    'reports a %s failure as a notice',
    (kind) => {
      const state = fail(waiting, new CalculatorError(kind, 'failed'))

      expect(state.notice).toBe(kind)
      expect(selectView(state).notice).toBe(messages.notices[kind])
    },
  )

  it('restores the operand of a failed square root', () => {
    const state = fail(run([digits('16'), squareRoot]), unreachable)

    expect(showing(state)).toEqual({ display: '16', expression: '' })
  })

  it('restores an operator chain that failed to send', () => {
    const state = fail(
      run([digits('2'), operator('add'), digits('3'), operator('multiply')]),
      unreachable,
    )

    expect(showing(state)).toEqual({ display: '3', expression: '2 +' })
    expect(run([operator('multiply')], state).pending?.request).toEqual({
      operation: 'add',
      a: 2,
      b: 3,
    })
  })
})
