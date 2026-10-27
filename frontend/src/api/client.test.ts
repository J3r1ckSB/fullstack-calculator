import { afterEach, describe, expect, it, vi } from 'vitest'
import contract from '../../../contract/examples.json'
import {
  CalculatorError,
  createCalculatorClient,
  type CalculationRequest,
  type ErrorKind,
} from './client'

type Example = (typeof contract.examples)[number]

const arity: Record<string, string[]> = {
  add: ['a', 'b'],
  subtract: ['a', 'b'],
  multiply: ['a', 'b'],
  divide: ['a', 'b'],
  power: ['a', 'b'],
  percentage: ['a', 'b'],
  sqrt: ['a'],
}

const addRequest: CalculationRequest = { operation: 'add', a: 1, b: 2 }

function operationOf(example: Example): string | undefined {
  const { method, path } = example.request
  if (method !== 'POST' || !path.startsWith('/api/v1/')) return undefined
  const operation = path.slice('/api/v1/'.length)
  return operation in arity ? operation : undefined
}

function clientCanProduce(example: Example): boolean {
  const { body, rawBody, headers } = example.request
  const operation = operationOf(example)
  if (!operation || rawBody !== undefined || headers !== undefined) return false
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return false
  const values: unknown[] = Object.values(body)
  return (
    Object.keys(body).sort().join() === arity[operation].join() &&
    values.every((value) => typeof value === 'number' && Number.isFinite(value))
  )
}

function expectedKind(status: number): ErrorKind {
  if (status >= 500) return 'server'
  return status === 422 ? 'math' : 'rejected'
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fakeFetch(response: () => Response | Promise<Response>) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response()))
}

// Rejects like the real fetch when its signal aborts.
function stalledFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error)
        })
      }),
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('contract examples the client can produce', () => {
  const examples = contract.examples.filter(clientCanProduce)

  it('covers every operation', () => {
    const covered = new Set(examples.map(operationOf))
    expect([...covered].sort()).toEqual(Object.keys(arity).sort())
  })

  it.each(examples.map((example) => [example.name, example] as const))(
    '%s',
    async (_name, example) => {
      const send = fakeFetch(() =>
        respond(example.response.status, example.response.body),
      )
      const client = createCalculatorClient({ fetch: send })
      const operation = operationOf(example) as CalculationRequest['operation']
      const request = {
        operation,
        ...example.request.body,
      } as CalculationRequest

      const outcome = client.calculate(request)

      if (example.response.status === 200) {
        await expect(outcome).resolves.toBe(
          (example.response.body as { result: number }).result,
        )
      } else {
        const { error } = example.response.body as {
          error: { code: string; message: string }
        }
        await expect(outcome).rejects.toMatchObject({
          name: 'CalculatorError',
          kind: expectedKind(example.response.status),
          code: error.code,
          status: example.response.status,
          message: error.message,
        })
      }

      expect(send).toHaveBeenCalledOnce()
      const [url, init] = send.mock.calls[0]
      expect(url).toBe(example.request.path)
      expect(init?.method).toBe(example.request.method)
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(init?.body as string)).toEqual(example.request.body)
    },
  )
})

describe('error responses outside the 422 math errors', () => {
  const rejections = contract.examples.filter(
    ({ response }) =>
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 422,
  )

  it.each(rejections.map((example) => [example.name, example] as const))(
    'reads "%s" as rejected',
    async (_name, example) => {
      const client = createCalculatorClient({
        fetch: fakeFetch(() =>
          respond(example.response.status, example.response.body),
        ),
      })

      await expect(client.calculate(addRequest)).rejects.toMatchObject({
        kind: 'rejected',
        status: example.response.status,
      })
    },
  )

  it('does not call a 422 with an unknown code a math error', async () => {
    const body = { error: { code: 'something_new', message: 'something new' } }
    const client = createCalculatorClient({
      fetch: fakeFetch(() => respond(422, body)),
    })

    await expect(client.calculate(addRequest)).rejects.toMatchObject({
      kind: 'rejected',
      code: 'something_new',
    })
  })
})

describe('transport failures', () => {
  it('reports an unreachable service as network and keeps the cause', async () => {
    const cause = new TypeError('Failed to fetch')
    const client = createCalculatorClient({
      fetch: vi.fn<typeof fetch>(() => Promise.reject(cause)),
    })

    const error = await client.calculate(addRequest).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CalculatorError)
    expect(error).toMatchObject({ kind: 'network', cause })
  })

  it('reports no answer within timeoutMs as timeout', async () => {
    vi.useFakeTimers()
    const client = createCalculatorClient({
      fetch: stalledFetch(),
      timeoutMs: 500,
    })

    const outcome = expect(client.calculate(addRequest)).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(500)

    await outcome
  })

  it('does not time out when the answer arrives in time', async () => {
    vi.useFakeTimers()
    const client = createCalculatorClient({
      fetch: fakeFetch(() => respond(200, { result: 3 })),
      timeoutMs: 500,
    })

    await expect(client.calculate(addRequest)).resolves.toBe(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rethrows the abort error unchanged when the caller aborts', async () => {
    const controller = new AbortController()
    const client = createCalculatorClient({ fetch: stalledFetch() })

    const outcome = client.calculate(addRequest, { signal: controller.signal })
    controller.abort()

    const error = await outcome.catch((e: unknown) => e)
    expect(error).toBe(controller.signal.reason)
    expect(error).not.toBeInstanceOf(CalculatorError)
  })

  it('reports a 500 with a non-JSON body as server', async () => {
    const client = createCalculatorClient({
      fetch: fakeFetch(
        () => new Response('<html>bad gateway</html>', { status: 500 }),
      ),
    })

    await expect(client.calculate(addRequest)).rejects.toMatchObject({
      kind: 'server',
      status: 500,
    })
  })
})

describe('unreadable answers', () => {
  it.each([
    ['has no result', {}],
    ['has a non-numeric result', { result: '3' }],
    ['has a null result', { result: null }],
    ['is not an object', [3]],
  ])('reports a 200 whose body %s', async (_name, body) => {
    const client = createCalculatorClient({
      fetch: fakeFetch(() => respond(200, body)),
    })

    await expect(client.calculate(addRequest)).rejects.toMatchObject({
      kind: 'unreadable',
      status: 200,
    })
  })

  it('reports a 200 with a non-JSON body and keeps the parse error as cause', async () => {
    const client = createCalculatorClient({
      fetch: fakeFetch(() => new Response('ok', { status: 200 })),
    })

    const error = await client.calculate(addRequest).catch((e: unknown) => e)

    expect(error).toMatchObject({ kind: 'unreadable' })
    expect((error as CalculatorError).cause).toBeInstanceOf(SyntaxError)
  })

  it.each([
    ['is not JSON', () => new Response('nope', { status: 400 })],
    ['has no error object', () => respond(400, { message: 'bad' })],
    [
      'has an error without a code',
      () => respond(400, { error: { message: 'bad' } }),
    ],
  ])('reports a 4xx whose body %s', async (_name, response) => {
    const client = createCalculatorClient({ fetch: fakeFetch(response) })

    await expect(client.calculate(addRequest)).rejects.toMatchObject({
      kind: 'unreadable',
      status: 400,
    })
  })
})
