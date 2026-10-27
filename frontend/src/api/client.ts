export type BinaryOperation =
  'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
export type UnaryOperation = 'sqrt'

export type CalculationRequest =
  | { operation: BinaryOperation; a: number; b: number }
  | { operation: UnaryOperation; a: number }

export interface CalculatorClient {
  calculate(
    request: CalculationRequest,
    options?: { signal?: AbortSignal },
  ): Promise<number>
}

export interface CalculatorClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export type ErrorKind =
  'math' | 'rejected' | 'server' | 'network' | 'timeout' | 'unreadable'

const MATH_ERROR_CODES = [
  'division_by_zero',
  'negative_square_root',
  'undefined_result',
  'result_out_of_range',
] as const

export type MathErrorCode = (typeof MATH_ERROR_CODES)[number]

export function isMathErrorCode(code: unknown): code is MathErrorCode {
  return MATH_ERROR_CODES.some((known) => known === code)
}

export class CalculatorError extends Error {
  readonly kind: ErrorKind
  readonly code?: string
  readonly status?: number

  constructor(
    kind: ErrorKind,
    message: string,
    details: { code?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: details.cause })
    this.name = 'CalculatorError'
    this.kind = kind
    this.code = details.code
    this.status = details.status
  }
}

// Not a measurement: calls to the local service take milliseconds. The limit
// only stops a stalled request from freezing the calculator.
const DEFAULT_TIMEOUT_MS = 10_000

export function createCalculatorClient({
  baseUrl = '/api/v1',
  fetch: send = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CalculatorClientOptions = {}): CalculatorClient {
  return {
    async calculate({ operation, ...operands }, { signal } = {}) {
      if (signal?.aborted) throw signal.reason
      // AbortSignal.any is missing in some browsers Vite still builds for.
      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const forwardAbort = () => {
        controller.abort(signal?.reason)
      }
      signal?.addEventListener('abort', forwardAbort, { once: true })
      try {
        const response = await send(`${baseUrl}/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operands),
          signal: controller.signal,
        })
        return await readResult(response)
      } catch (error) {
        if (signal?.aborted) throw error
        if (timedOut) {
          throw new CalculatorError(
            'timeout',
            'the service did not answer in time',
            {
              cause: error,
            },
          )
        }
        if (error instanceof CalculatorError) throw error
        throw new CalculatorError('network', 'the service is unreachable', {
          cause: error,
        })
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', forwardAbort)
      }
    },
  }
}

async function readResult(response: Response): Promise<number> {
  const { status } = response
  if (status >= 500) {
    throw new CalculatorError('server', `the service answered ${status}`, {
      status,
    })
  }

  const body = await readJson(response)
  if (response.ok) {
    if (
      isRecord(body) &&
      typeof body.result === 'number' &&
      Number.isFinite(body.result)
    ) {
      return body.result
    }
    throw unreadable(status)
  }

  const detail = status >= 400 ? readErrorDetail(body) : undefined
  if (!detail) throw unreadable(status)
  const kind =
    status === 422 && isMathErrorCode(detail.code) ? 'math' : 'rejected'
  throw new CalculatorError(kind, detail.message, { code: detail.code, status })
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch (cause) {
    throw unreadable(response.status, cause)
  }
}

function readErrorDetail(
  body: unknown,
): { code: string; message: string } | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined
  const { code, message } = body.error
  if (typeof code !== 'string' || typeof message !== 'string') return undefined
  return { code, message }
}

function unreadable(status: number, cause?: unknown): CalculatorError {
  return new CalculatorError(
    'unreadable',
    `the service answered ${status} with an unexpected body`,
    {
      status,
      cause,
    },
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
