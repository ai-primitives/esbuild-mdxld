import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mdxld } from '../index'
import { createBuildStub } from './utils'
import { mockFetch } from './setup'
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

  const getHandlerForNamespace = (namespace: string) => {
    return (build.onLoad as any).handlers?.get(namespace)
  }

  it('should resolve HTTP imports', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
    const result = await callback({ path: 'https://example.com/test.mdx', namespace: 'http-url' })
    expect(result.contents).toBe('Response 1')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.mdx')
  })

  it('should handle HTTP import errors', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
    const result = await callback({ path: 'https://example.com/error.mdx', namespace: 'http-url' })
    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/error.mdx')
  })

  it('should cache HTTP responses', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
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
