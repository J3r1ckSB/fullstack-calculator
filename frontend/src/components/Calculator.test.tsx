import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  CalculatorError,
  type CalculationRequest,
  type CalculatorClient,
} from '../api/client'
import { messages } from '../messages'
import { Calculator } from './Calculator'

type Outcome = number | CalculatorError

const keyOf = (request: CalculationRequest) =>
  'b' in request
    ? `${request.operation} ${request.a} ${request.b}`
    : `${request.operation} ${request.a}`

// Results are written in the test, e.g. { 'add 12 7': 19 }. The map is read at
// call time, so a test can change an outcome between presses.
function fakeClient(results: Record<string, Outcome>) {
  const calls: string[] = []
  const client: CalculatorClient = {
    calculate: (request) => {
      const key = keyOf(request)
      calls.push(key)
      const outcome = results[key]
      if (outcome === undefined) {
        return Promise.reject(new Error(`unexpected request: ${key}`))
      }
      return outcome instanceof CalculatorError
        ? Promise.reject(outcome)
        : Promise.resolve(outcome)
    },
  }
  return { client, calls }
}

function setup(results: Record<string, Outcome> = {}) {
  const { client, calls } = fakeClient(results)
  const user = userEvent.setup()
  render(<Calculator client={client} />)
  const click = async (...names: string[]) => {
    for (const name of names) {
      await user.click(screen.getByRole('button', { name }))
    }
  }
  return { user, click, calls }
}

const name = {
  add: messages.keys.add.name,
  divide: messages.keys.divide.name,
  equals: messages.keys.equals.name,
  clear: messages.keys.clear.name,
  backspace: messages.keys.backspace.name,
  toggleSign: messages.keys.toggleSign.name,
  decimal: messages.keys.decimal.name,
  squareRoot: messages.keys.squareRoot.name,
}

const value = () => screen.getByRole('status')
// toHaveTextContent matches substrings, which would let "57" pass for "5".
const expectValue = (text: string) => {
  expect(value().textContent).toBe(text)
}

describe('Calculator', () => {
  it('shows the heading and a zero', () => {
    setup()

    expect(
      screen.getByRole('heading', { level: 1, name: messages.heading }),
    ).toBeInTheDocument()
    expectValue('0')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('adds two numbers from clicks', async () => {
    const { click, calls } = setup({ 'add 12 7': 19 })

    await click('1', '2', name.add)
    expect(screen.getByText('12 +')).toBeInTheDocument()
    await click('7', name.equals)

    expect(await screen.findByText('12 + 7 =')).toBeInTheDocument()
    expectValue('19')
    expect(calls).toEqual(['add 12 7'])
  })

  it('starts a new calculation when a digit follows equals', async () => {
    const { click } = setup({ 'add 1 2': 3 })

    await click('1', name.add, '2', name.equals)
    await screen.findByText('1 + 2 =')
    await click('5')

    expectValue('5')
  })

  it('takes a square root', async () => {
    const { click } = setup({ 'sqrt 16': 4 })

    await click('1', '6', name.squareRoot)

    expect(await screen.findByText('√(16)')).toBeInTheDocument()
    expectValue('4')
  })

  it('edits the entry with sign, decimal point and backspace', async () => {
    const { click } = setup()

    await click('1', '2', name.backspace)
    expectValue('1')
    await click(name.decimal, '5', name.decimal)
    expectValue('1.5')
    await click(name.toggleSign)
    expectValue('−1.5')
    await click(name.toggleSign)
    expectValue('1.5')
  })

  it('resets with all clear', async () => {
    const { click } = setup()

    await click('9', name.add, '4', name.clear)

    expectValue('0')
    expect(screen.queryByText('9 +')).not.toBeInTheDocument()
  })

  describe('errors', () => {
    const divisionByZero = new CalculatorError('math', 'x', {
      code: 'division_by_zero',
    })

    it('shows the catalog message and a hint, then a digit starts over', async () => {
      const { click } = setup({ 'divide 8 0': divisionByZero })

      await click('8', name.divide, '0', name.equals)

      expect(await screen.findByText(messages.errorHint)).toBeInTheDocument()
      expectValue(messages.mathErrors.division_by_zero)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await click('5')

      expectValue('5')
      expect(screen.queryByText(messages.errorHint)).not.toBeInTheDocument()
    })

    it('shows an alert for a network failure and retries on the same key', async () => {
      const results: Record<string, Outcome> = {
        'add 12 7': new CalculatorError('network', 'x'),
      }
      const { click, calls } = setup(results)

      await click('1', '2', name.add, '7', name.equals)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        messages.notices.network,
      )
      expect(screen.getByText('12 +')).toBeInTheDocument()
      expectValue('7')

      results['add 12 7'] = 19
      await click(name.equals)

      expect(await screen.findByText('12 + 7 =')).toBeInTheDocument()
      expectValue('19')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(calls).toEqual(['add 12 7', 'add 12 7'])
    })

    it('shows an alert when the client fails in an unexpected way', async () => {
      const { click } = setup()

      await click('1', name.add, '2', name.equals)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        messages.notices.unreadable,
      )
    })
  })

  it('marks the value busy while a request is in flight', async () => {
    let resolve: (result: number) => void = () => undefined
    const client: CalculatorClient = {
      calculate: () =>
        new Promise<number>((r) => {
          resolve = r
        }),
    }
    const user = userEvent.setup()
    render(<Calculator client={client} />)
    for (const label of ['1', name.add, '2', name.equals]) {
      await user.click(screen.getByRole('button', { name: label }))
    }

    expect(value()).toHaveAttribute('aria-busy', 'true')

    resolve(3)

    expect(await screen.findByText('1 + 2 =')).toBeInTheDocument()
    expect(value()).toHaveAttribute('aria-busy', 'false')
    expectValue('3')
  })

  describe('keyboard', () => {
    it('adds two numbers from key presses', async () => {
      const { user, calls } = setup({ 'add 12 7': 19 })

      await user.keyboard('12+7{Enter}')

      expect(await screen.findByText('12 + 7 =')).toBeInTheDocument()
      expectValue('19')
      expect(calls).toEqual(['add 12 7'])
    })

    it.each([
      ['+', 'add', '+'],
      ['-', 'subtract', '−'],
      ['*', 'multiply', '×'],
      ['/', 'divide', '÷'],
      ['^', 'power', '^'],
      ['%', 'percentage', '% of'],
    ])('presses %s as %s', async (key, operation, symbol) => {
      const { user } = setup({ [`${operation} 6 3`]: 9 })

      await user.keyboard(`6${key}3=`)

      expect(await screen.findByText(`6 ${symbol} 3 =`)).toBeInTheDocument()
      expectValue('9')
    })

    it.each(['.', ','])('enters a decimal point with %s', async (key) => {
      const { user } = setup()

      await user.keyboard(`1${key}5`)

      expectValue('1.5')
    })

    it('backspaces and clears', async () => {
      const { user } = setup()

      await user.keyboard('123{Backspace}')
      expectValue('12')
      await user.keyboard('{Escape}')
      expectValue('0')
      await user.keyboard('45{Delete}')
      expectValue('0')
    })

    it('applies Enter once when a digit button has focus', async () => {
      const { user, calls } = setup()
      await user.keyboard('5')
      screen.getByRole('button', { name: '7' }).focus()

      await user.keyboard('{Enter}')

      expectValue('5')
      expect(calls).toEqual([])
    })

    it('applies Enter once when the equals button has focus', async () => {
      const { user, calls } = setup({ 'add 1 2': 3 })
      await user.keyboard('1+2')
      screen.getByRole('button', { name: name.equals }).focus()

      await user.keyboard('{Enter}')

      expect(await screen.findByText('1 + 2 =')).toBeInTheDocument()
      expect(calls).toEqual(['add 1 2'])
    })

    it('cancels the keys it handles and no others', () => {
      setup()

      const handled = fireEvent.keyDown(window, { key: '/' })
      const unhandled = fireEvent.keyDown(window, { key: 'a' })

      expect(handled).toBe(false)
      expect(unhandled).toBe(true)
    })

    it.each(['Control', 'Meta', 'Alt'])(
      'leaves %s shortcuts alone',
      async (modifier) => {
        const { user } = setup()

        await user.keyboard(`{${modifier}>}5{/${modifier}}`)
        const notCancelled = fireEvent.keyDown(window, {
          key: '5',
          ctrlKey: modifier === 'Control',
          metaKey: modifier === 'Meta',
          altKey: modifier === 'Alt',
        })

        expectValue('0')
        expect(notCancelled).toBe(true)
      },
    )
  })
})
