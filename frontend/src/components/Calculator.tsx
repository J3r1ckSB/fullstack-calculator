import type { CalculatorClient } from '../api/client'
import { useCalculator } from '../calculator/useCalculator'
import { messages } from '../messages'
import { Display } from './Display'
import { Keypad } from './Keypad'

export function Calculator({ client }: { client: CalculatorClient }) {
  const { view, press } = useCalculator(client)
  return (
    <main className="calculator">
      <h1 className="visually-hidden">{messages.heading}</h1>
      <Display view={view} />
      {view.notice !== null && (
        <p className="notice" role="alert">
          {view.notice}
        </p>
      )}
      <Keypad press={press} />
    </main>
  )
}
