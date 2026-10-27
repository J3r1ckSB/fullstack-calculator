import type { BinaryOperation, ErrorKind, MathErrorCode } from './api/client'

const unexpectedAnswer =
  'The calculator service sent an unexpected answer. Try again.'

export const messages = {
  mathErrors: {
    division_by_zero: "Can't divide by zero",
    negative_square_root: 'No real square root',
    undefined_result: 'No real result',
    result_out_of_range: 'Result too large',
  } satisfies Record<MathErrorCode, string>,

  // The client only reports a math error with a known code, so the math entry
  // is a fallback that keeps the table exhaustive.
  notices: {
    network:
      "Can't reach the calculator service. Check that it is running, then try again.",
    timeout: 'The calculator service took too long to answer. Try again.',
    server: 'The calculator service had a problem. Try again in a moment.',
    rejected: unexpectedAnswer,
    unreadable: unexpectedAnswer,
    math: unexpectedAnswer,
  } satisfies Record<ErrorKind, string>,

  errorHint: 'Enter a number or press AC to start over',

  operatorSymbols: {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
    power: '^',
    percentage: '% of',
  } satisfies Record<BinaryOperation, string>,
} as const
