import { useCallback, useEffect, useReducer } from 'react'
import { CalculatorError, type CalculatorClient } from '../api/client'
import {
  initialState,
  reducer,
  selectView,
  type Action,
  type CalculatorView,
} from './state'

export function useCalculator(client: CalculatorClient): {
  view: CalculatorView
  press: (action: Action) => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { pending } = state

  // `pending` changes only when a new request starts, so the request is not
  // sent again when other parts of the state change.
  useEffect(() => {
    if (!pending) return
    const controller = new AbortController()
    const { id, request } = pending
    client.calculate(request, { signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return
        dispatch({ type: 'succeeded', id, result })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        dispatch({ type: 'failed', id, error: asCalculatorError(error) })
      },
    )
    return () => {
      controller.abort()
    }
  }, [pending, client])

  const press = useCallback((action: Action) => {
    dispatch(action)
  }, [])

  return { view: selectView(state), press }
}

function asCalculatorError(error: unknown): CalculatorError {
  return error instanceof CalculatorError
    ? error
    : new CalculatorError('unreadable', 'the calculation failed unexpectedly', {
        cause: error,
      })
}
