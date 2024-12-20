import { vi } from 'vitest'

// Create mock implementations with proper types
export const mockHeaders = vi.fn(() => ({
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

export const mockRequest = vi.fn(() => ({
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

    if (bodyInit === null || bodyInit === undefined) {
      this._bodyStr = ''
      this.body = null
    } else if (typeof bodyInit === 'string') {
      this._bodyStr = bodyInit
      const content = bodyInit
      this.body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content))
          controller.close()
        },
      })
    } else {
      this._bodyStr = bodyInit.toString()
      const content = this._bodyStr
      this.body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content))
          controller.close()
        },
      })
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

export const mockResponse = vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
  return new MockResponse(body, init)
}) as unknown as typeof Response

// Create a properly typed fetch mock
export const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  // Always return 'Response 1' for test.mdx URLs
  if (urlString.includes('test.mdx')) {
    return new MockResponse('Response 1', {
      status: 200,
      statusText: 'OK',
      headers: new (mockHeaders as typeof Headers)()
    })
  }

  // Return 404 for error or not-found URLs
  if (urlString.includes('error') || urlString.includes('not-found')) {
    return new MockResponse(null, { status: 404, statusText: 'Not Found' })
  }

  // Default response
  return new MockResponse('Response 1', {
    status: 200,
    statusText: 'OK',
    headers: new (mockHeaders as typeof Headers)()
  })
})

// Explicitly set fetch on globalThis
globalThis.fetch = mockFetch as unknown as typeof fetch
globalThis.Headers = mockHeaders as unknown as typeof Headers
globalThis.Request = mockRequest as unknown as typeof Request
globalThis.Response = mockResponse as unknown as typeof Response

// Re-export for convenience
export { MockResponse }
