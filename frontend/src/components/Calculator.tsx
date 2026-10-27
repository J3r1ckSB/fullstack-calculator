import { useEffect } from 'react'
import type { CalculatorClient } from '../api/client'
import { useCalculator } from '../calculator/useCalculator'
import { messages } from '../messages'
import { Display } from './Display'
import { Keypad } from './Keypad'
import { actionForShortcut } from './keys'

export function Calculator({ client }: { client: CalculatorClient }) {
  const { view, press } = useCalculator(client)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = actionForShortcut(event.key)
      if (!action) return
      // Also stops a focused button from turning Enter into a second click, and
      // keeps "/" from opening Firefox quick find.
      event.preventDefault()
      press(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [press])

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
