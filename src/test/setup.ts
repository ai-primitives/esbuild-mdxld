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

const mockResponse = vi.fn((body?: BodyInit | null, init?: ResponseInit) => ({
  ok: init?.status === undefined || init.status >= 200 && init.status < 300,
  status: init?.status ?? 200,
  statusText: init?.statusText ?? 'OK',
  headers: new (mockHeaders as typeof Headers)(),
  text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : 'Test content'),
  json: vi.fn(),
})) as unknown as typeof Response

// Create a mock fetch function
const mockFetch = vi.fn().mockImplementation(async () => {
  return new (mockResponse as typeof Response)('Test content', {
    status: 200,
    statusText: 'OK',
  })
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
