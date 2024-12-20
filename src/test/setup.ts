import { vi } from 'vitest'

// Setup global fetch for Node.js environment
if (!global.fetch) {
  global.fetch = vi.fn() as unknown as typeof fetch
  global.Headers = vi.fn(() => ({
    append: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
    set: vi.fn(),
    forEach: vi.fn(),
  })) as unknown as typeof Headers

  global.Request = vi.fn(() => ({
    method: 'GET',
    url: '',
    headers: new Headers(),
  })) as unknown as typeof Request

  global.Response = vi.fn(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: vi.fn(),
    json: vi.fn(),
  })) as unknown as typeof Response
}
