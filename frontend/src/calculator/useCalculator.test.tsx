import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CalculatorError,
  type CalculationRequest,
  type CalculatorClient,
} from '../api/client'
import { messages } from '../messages'
import { useCalculator } from './useCalculator'
import type { Action, Digit } from './state'

interface Call {
  request: CalculationRequest
  signal: AbortSignal | undefined
  resolve: (result: number) => void
  reject: (error: unknown) => void
}

// Every call stays in flight until the test settles it.
function fakeClient() {
  const calls: Call[] = []
  const client: CalculatorClient = {
    calculate: (request, options) =>
      new Promise<number>((resolve, reject) => {
        calls.push({ request, signal: options?.signal, resolve, reject })
      }),
  }
  return { client, calls }
}

// Awaiting lets the promise reactions run inside act.
function settle(action: () => void) {
  return act(() => {
    action()
    return Promise.resolve()
  })
}

const digit = (value: Digit): Action => ({ type: 'digit', digit: value })
const plus: Action = { type: 'operator', operator: 'add' }
const equals: Action = { type: 'equals' }
const clear: Action = { type: 'clear' }

function setup(options?: { strict?: boolean }) {
  const { client, calls } = fakeClient()
  const hook = renderHook(() => useCalculator(client), {
    reactStrictMode: options?.strict,
  })
  const press = (...actions: Action[]) => {
    act(() => {
      for (const action of actions) hook.result.current.press(action)
    })
  }
  return { ...hook, calls, press }
}

describe('useCalculator', () => {
  it('starts at 0', () => {
    const { result } = setup()

    expect(result.current.view.display).toBe('0')
  })

  it('sends the request and applies its result', async () => {
    const { result, calls, press } = setup()

    press(digit('1'), digit('2'), plus, digit('7'), equals)

    expect(calls).toHaveLength(1)
    expect(calls[0].request).toEqual({ operation: 'add', a: 12, b: 7 })
    expect(result.current.view.status).toBe('computing')

    await settle(() => {
      calls[0].resolve(19)
    })

    expect(result.current.view).toMatchObject({
      display: '19',
      expression: '12 + 7 =',
      status: 'ready',
    })
  })

  it('does not send the request again when other input arrives', () => {
    const { calls, press } = setup()

    press(digit('1'), plus, digit('2'), equals, digit('3'), plus)

    expect(calls).toHaveLength(1)
  })

  it('aborts the request in flight on all clear and ignores its late result', async () => {
    const { result, calls, press } = setup()
    press(digit('1'), plus, digit('2'), equals)

    press(clear)

    expect(calls[0].signal?.aborted).toBe(true)

    await settle(() => {
      calls[0].resolve(3)
    })
    expect(result.current.view).toMatchObject({ display: '0', status: 'ready' })
  })

  it('ignores the abort rejection of a cancelled request', async () => {
    const { result, calls, press } = setup()
    press(digit('1'), plus, digit('2'), equals)
    press(clear)

    await settle(() => {
      calls[0].reject(new DOMException('aborted', 'AbortError'))
    })

    expect(result.current.view).toMatchObject({ display: '0', notice: null })
  })

  it('maps a transport failure to a notice and retries on the same key', async () => {
    const { result, calls, press } = setup()
    press(digit('1'), plus, digit('2'), equals)

    await settle(() => {
      calls[0].reject(new CalculatorError('network', 'unreachable'))
    })

    expect(result.current.view).toMatchObject({
      display: '2',
      status: 'ready',
      notice: messages.notices.network,
    })

    press(equals)

    expect(calls).toHaveLength(2)
    expect(calls[1].request).toEqual(calls[0].request)
    expect(result.current.view.notice).toBeNull()
  })

  it('shows a math error from the client', async () => {
    const { result, calls, press } = setup()
    press(
      digit('1'),
      { type: 'operator', operator: 'divide' },
      digit('0'),
      equals,
    )

    await settle(() => {
      calls[0].reject(
        new CalculatorError('math', 'division by zero is undefined', {
          code: 'division_by_zero',
          status: 422,
        }),
      )
    })

    expect(result.current.view).toMatchObject({
      display: messages.mathErrors.division_by_zero,
      status: 'error',
    })
  })

  it('treats a rejection that is not a CalculatorError as an unexpected answer', async () => {
    const { result, calls, press } = setup()
    press(digit('1'), plus, digit('2'), equals)

    await settle(() => {
      calls[0].reject(new Error('boom'))
    })

    expect(result.current.view.notice).toBe(messages.notices.unreadable)
  })

  it('sends one request and applies its result under StrictMode', async () => {
    const { result, calls, press } = setup({ strict: true })
    press(digit('1'), plus, digit('2'), equals)

    expect(calls).toHaveLength(1)

    await settle(() => {
      calls[0].resolve(3)
    })

    expect(result.current.view.display).toBe('3')
  })
})
