/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { vi } from 'vitest'

// Create mock implementations with proper types
const mockHeaders = vi.fn(() => ({
  append: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  has: vi.fn(),
  set: vi.fn(),
  forEach: vi.fn(),
})) as unknown as typeof Headers

const mockRequest = vi.fn(() => ({
  method: 'GET',
  url: '',
  headers: new (mockHeaders as typeof Headers)(),
})) as unknown as typeof Request

class MockResponse {
  private body: string
  private responseInit: ResponseInit

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.body = typeof body === 'string' ? body : 'Test content'
    this.responseInit = init || { status: 200, statusText: 'OK' }
  }

  get ok() {
    return this.responseInit.status === undefined || (this.responseInit.status >= 200 && this.responseInit.status < 300)
  }

  get status() {
    return this.responseInit.status ?? 200
  }

  get statusText() {
    return this.responseInit.statusText ?? 'OK'
  }

  get headers() {
    return new (mockHeaders as typeof Headers)()
  }

  text() {
    return Promise.resolve(this.body)
  }

  json() {
    return Promise.resolve({})
  }
}

const mockResponse = vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
  return new MockResponse(body, init)
}) as unknown as typeof Response

const mockFetch = vi.fn().mockImplementation(async (url: string) => {
  if (url.includes('error') || url.includes('not-found')) {
    return new MockResponse(null, { status: 404, statusText: 'Not Found' })
  }
  if (url.includes('test.mdx')) {
    return new MockResponse('Response 1')
  }
  return new MockResponse('Test content')
})

// Export mocks for test usage
export const mocks = {
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
