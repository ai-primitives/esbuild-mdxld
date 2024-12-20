import { vi } from 'vitest'

// Create mock implementations with proper types
const mockHeaders = vi.fn(() => ({
  append: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  has: vi.fn(),
  set: vi.fn(),
  forEach: vi.fn(),
  entries: vi.fn(),
  keys: vi.fn(),
  values: vi.fn(),
})) as unknown as typeof Headers

const mockRequest = vi.fn(() => ({
  method: 'GET',
  url: '',
  headers: new (mockHeaders as typeof Headers)(),
  clone: vi.fn(),
  arrayBuffer: vi.fn(),
  blob: vi.fn(),
  formData: vi.fn(),
  json: vi.fn(),
  text: vi.fn(),
})) as unknown as typeof Request

class MockResponse implements Response {
  readonly type: ResponseType
  readonly url: string
  readonly redirected: boolean
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  readonly headers: Headers
  readonly body: ReadableStream<Uint8Array> | null
  readonly bodyUsed: boolean

  private _bodyStr: string

  constructor(bodyInit?: BodyInit | null, init?: ResponseInit) {
    const initOptions = init || { status: 200, statusText: 'OK' }
    this.type = 'default'
    this.url = ''
    this.redirected = false
    this.status = initOptions.status ?? 200
    this.statusText = initOptions.statusText ?? 'OK'
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new (mockHeaders as typeof Headers)()
    this.bodyUsed = false
    this._bodyStr = ''

    if (bodyInit === null || bodyInit === undefined) {
      this.body = null
    } else if (typeof bodyInit === 'string') {
      this._bodyStr = bodyInit
      this.body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyInit))
          controller.close()
        },
      })
    } else {
      this._bodyStr = 'Test content'
      this.body = null
    }
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new TextEncoder().encode(this._bodyStr).buffer
  }

  async blob(): Promise<Blob> {
    return new Blob([this._bodyStr])
  }

  clone(): Response {
    return new MockResponse(this._bodyStr, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    })
  }

  async formData(): Promise<FormData> {
    throw new Error('FormData not implemented in mock')
  }

  async json(): Promise<unknown> {
    try {
      return JSON.parse(this._bodyStr)
    } catch {
      return {}
    }
  }

  async text(): Promise<string> {
    return this._bodyStr
  }
}

const mockResponse = vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
  return new MockResponse(body, init)
}) as unknown as typeof Response

const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (urlString.includes('error') || urlString.includes('not-found')) {
    return new MockResponse(null, { status: 404, statusText: 'Not Found' })
  }
  if (urlString.includes('test.mdx')) {
    return new MockResponse('Response 1')
  }
  return new MockResponse('Test content')
}) as unknown as typeof globalThis.fetch

// Export mocks with explicit type annotation
export const mocks: {
  fetch: typeof globalThis.fetch
  Headers: typeof Headers
  Request: typeof Request
  Response: typeof Response
} = {
  fetch: mockFetch,
  Headers: mockHeaders,
  Request: mockRequest,
  Response: mockResponse,
}

// Assign mocks to globalThis
globalThis.fetch = mockFetch
globalThis.Headers = mockHeaders
globalThis.Request = mockRequest
globalThis.Response = mockResponse
