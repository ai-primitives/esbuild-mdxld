import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mdxld } from '../index'
import { createBuildStub } from './utils'

describe('mdxld plugin - HTTP imports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve HTTP imports', async () => {
    const mockGet = vi.fn().mockImplementation(async () => ({
      ok: true,
      text: async () => 'Test content'
    }))
    vi.stubGlobal('fetch', mockGet)

    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build)

    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]
    const result = await callback({ path: 'https://example.com/test.mdx' })

    expect(result.contents).toBe('Test content')
    expect(result.loader).toBe('mdx')
    expect(mockGet).toHaveBeenCalled()
  })

  it('should handle HTTP import errors', async () => {
    const mockGet = vi.fn().mockImplementation(() => {
      throw new Error('HTTP 404: Not Found')
    })
    vi.stubGlobal('fetch', mockGet)

    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build)

    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]
    const result = await callback({ path: 'https://example.com/not-found.mdx' })

    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mockGet).toHaveBeenCalled()
  })

  it('should cache HTTP responses', async () => {
    const responses = ['Response 1', 'Response 2']
    let callCount = 0

    const mockGet = vi.fn().mockImplementation(async () => ({
      ok: true,
      text: async () => responses[callCount++]
    }))
    vi.stubGlobal('fetch', mockGet)

    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build)

    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]

    // First request
    const result1 = await callback({ path: 'https://example.com/test.mdx' })
    expect(result1.contents).toBe('Response 1')
    expect(result1.loader).toBe('mdx')

    // Second request (should use cache)
    const result2 = await callback({ path: 'https://example.com/test.mdx' })
    expect(result2.contents).toBe('Response 1')
    expect(result2.loader).toBe('mdx')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
