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

const mockResponse = vi.fn(() => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new (mockHeaders as typeof Headers)(),
  text: vi.fn(),
  json: vi.fn(),
})) as unknown as typeof Response

// Assign mocks to globalThis if fetch is not already defined
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
  globalThis.Headers = mockHeaders
  globalThis.Request = mockRequest
  globalThis.Response = mockResponse
}
