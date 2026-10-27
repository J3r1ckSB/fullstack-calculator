import { messages } from '../messages'
import type { Action, Digit } from '../calculator/state'

export interface KeyDefinition {
  label: string
  // Present when the label alone is not a good accessible name.
  name?: string
  action: Action
  // Values of KeyboardEvent.key that press this key.
  shortcuts: readonly string[]
  kind: 'digit' | 'function' | 'operator' | 'equals'
  span?: 'wide' | 'tall'
}

const digit = (value: Digit): KeyDefinition => ({
  label: value,
  action: { type: 'digit', digit: value },
  shortcuts: [value],
  kind: 'digit',
})

const operatorShortcuts = {
  divide: '/',
  power: '^',
  percentage: '%',
  multiply: '*',
  subtract: '-',
  add: '+',
}

const operator = (id: keyof typeof operatorShortcuts): KeyDefinition => ({
  ...messages.keys[id],
  action: { type: 'operator', operator: id },
  shortcuts: [operatorShortcuts[id]],
  kind: 'operator',
})

// The grid places keys in this order, row by row.
export const keys: readonly KeyDefinition[] = [
  {
    ...messages.keys.clear,
    action: { type: 'clear' },
    shortcuts: ['Escape', 'Delete'],
    kind: 'function',
  },
  {
    ...messages.keys.backspace,
    action: { type: 'backspace' },
    shortcuts: ['Backspace'],
    kind: 'function',
  },
  {
    ...messages.keys.toggleSign,
    action: { type: 'toggleSign' },
    shortcuts: [],
    kind: 'function',
  },
  operator('divide'),
  {
    ...messages.keys.squareRoot,
    action: { type: 'squareRoot' },
    shortcuts: [],
    kind: 'function',
  },
  operator('power'),
  operator('percentage'),
  operator('multiply'),
  digit('7'),
  digit('8'),
  digit('9'),
  operator('subtract'),
  digit('4'),
  digit('5'),
  digit('6'),
  operator('add'),
  digit('1'),
  digit('2'),
  digit('3'),
  {
    ...messages.keys.equals,
    action: { type: 'equals' },
    shortcuts: ['=', 'Enter'],
    kind: 'equals',
    span: 'tall',
  },
  { ...digit('0'), span: 'wide' },
  {
    ...messages.keys.decimal,
    action: { type: 'decimal' },
    shortcuts: ['.', ','],
    kind: 'digit',
  },
]

const actionsByShortcut = new Map(
  keys.flatMap(({ shortcuts, action }) =>
    shortcuts.map((shortcut) => [shortcut, action] as const),
  ),
)

export function actionForShortcut(key: string): Action | undefined {
  return actionsByShortcut.get(key)
}
