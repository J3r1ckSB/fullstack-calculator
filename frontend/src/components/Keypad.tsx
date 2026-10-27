import type { Action } from '../calculator/state'
import { keys } from './keys'

export function Keypad({ press }: { press: (action: Action) => void }) {
  return (
    <div className="keypad">
      {keys.map(({ label, name, action, kind, span }) => (
        <button
          key={label}
          type="button"
          className={`key key-${kind}${span ? ` key-${span}` : ''}`}
          aria-label={name}
          onClick={() => {
            press(action)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
