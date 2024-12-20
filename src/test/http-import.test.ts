import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mdxld } from '../index'
import { createBuildStub, MockWithHandlers } from './utils'
import { mockFetch } from './setup'
import type { PluginBuild, OnLoadArgs, OnLoadResult, OnResolveArgs } from 'esbuild'

export type HttpHandlerArgs = OnLoadArgs & OnResolveArgs & { resolveDir: string }
export type ExtendedOnLoadResult = OnLoadResult & { path?: string }

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
    return (build.onLoad as MockWithHandlers<typeof build.onLoad>).handlers?.get(namespace)
  }

  it('should resolve HTTP imports', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
    if (!callback) throw new Error('HTTP URL handler not found')

    const args: HttpHandlerArgs = {
      path: 'https://example.com/test.mdx',
      namespace: 'http-url',
      suffix: '',
      pluginData: null,
      with: {},
      resolveDir: '/',
      kind: 'entry-point',
      importer: '',
    }

    const result = (await callback(args)) as ExtendedOnLoadResult
    expect(result.contents).toBe('# Test Content')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.mdx')
  })

  it('should handle HTTP import errors', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
    if (!callback) throw new Error('HTTP URL handler not found')

    const args: HttpHandlerArgs = {
      path: 'https://example.com/error.mdx',
      namespace: 'http-url',
      suffix: '',
      pluginData: null,
      with: {},
      resolveDir: '/',
      kind: 'entry-point',
      importer: '',
    }

    const result = (await callback(args)) as ExtendedOnLoadResult
    expect(result.errors).toBeDefined()
    expect(result.errors![0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/error.mdx')
  })

  it('should cache HTTP responses', async () => {
    const callback = getHandlerForNamespace('http-url')
    expect(callback).toBeDefined()
    if (!callback) throw new Error('HTTP URL handler not found')

    const args: HttpHandlerArgs = {
      path: 'https://example.com/cached.mdx',
      namespace: 'http-url',
      suffix: '',
      pluginData: null,
      with: {},
      resolveDir: '/',
      kind: 'entry-point',
      importer: '',
    }

    // First request
    const result1 = (await callback(args)) as ExtendedOnLoadResult
    expect(result1.contents).toBe('# Cached Content')
    expect(result1.loader).toBe('mdx')

    // Second request should use cache
    const result2 = (await callback(args)) as ExtendedOnLoadResult
    expect(result2.contents).toBe('# Cached Content')
    expect(result2.loader).toBe('mdx')

    // Fetch should only be called once due to caching
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
