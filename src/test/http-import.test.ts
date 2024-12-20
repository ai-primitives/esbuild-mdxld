import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mdxld } from '../index'
import { createBuildStub } from './utils'
import { mockFetch, MockResponse } from './setup'
import type { PluginBuild } from 'esbuild'

describe('mdxld plugin - HTTP imports', () => {
  let plugin: ReturnType<typeof mdxld>
  let build: ReturnType<typeof createBuildStub>

  beforeEach(() => {
    vi.clearAllMocks()
    build = createBuildStub()
    plugin = mdxld()
    plugin.setup(build as unknown as PluginBuild)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve HTTP imports', async () => {
    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]

    vi.mocked(mockFetch).mockImplementationOnce(async () => {
      return new MockResponse('Test content', {
        status: 200,
        statusText: 'OK'
      })
    })

    const result = await callback({ path: 'https://example.com/test.mdx', namespace: 'http-url' })
    expect(result.contents).toBe('Test content')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalled()
  })

  it('should handle HTTP import errors', async () => {
    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]

    vi.mocked(mockFetch).mockImplementationOnce(async () => {
      return new MockResponse(null, {
        status: 404,
        statusText: 'Not Found'
      })
    })

    const result = await callback({ path: 'https://example.com/not-found.mdx', namespace: 'http-url' })
    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalled()
  })

  it('should cache HTTP responses', async () => {
    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]
    const testUrl = 'https://example.com/test.mdx'

    // First request
    const result1 = await callback({ path: testUrl, namespace: 'http-url' })
    expect(result1.contents).toBe('Response 1')
    expect(result1.loader).toBe('mdx')

    // Second request should use cache
    const result2 = await callback({ path: testUrl, namespace: 'http-url' })
    expect(result2.contents).toBe('Response 1')
    expect(result2.loader).toBe('mdx')

    // Fetch should only be called once due to caching
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
