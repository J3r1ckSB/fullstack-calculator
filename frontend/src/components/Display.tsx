import type { CalculatorView } from '../calculator/state'

// The main value steps down so that 24 characters fit the narrowest card.
function sizeFor(length: number): string {
  if (length <= 8) return 'xl'
  if (length <= 12) return 'l'
  if (length <= 16) return 'm'
  if (length <= 20) return 's'
  return 'xs'
}

export function Display({ view }: { view: CalculatorView }) {
  const busy = view.status === 'computing'
  return (
    <div className="display">
      <p className="expression">{view.expression}</p>
      <output
        className="value"
        data-size={sizeFor(view.display.length)}
        aria-live="polite"
        aria-atomic="true"
        aria-busy={busy}
      >
        {view.display}
      </output>
      {busy && <span className="busy" aria-hidden="true" />}
    </div>
  )
}
