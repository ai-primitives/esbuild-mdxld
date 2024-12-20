import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mdxld } from '../index'
import type { Plugin } from 'esbuild'

describe('HTTP import resolution', () => {
  let plugin: Plugin
  let build: any

  beforeEach(() => {
    plugin = mdxld({
      httpTimeout: 5000,
      httpCacheTTL: 1000
    })
    build = {
      onLoad: vi.fn(),
      onResolve: vi.fn(),
      initialOptions: {}
    }
    plugin.setup(build)
  })

  it('should resolve HTTP URLs in namespace', () => {
    const resolveCallback = build.onResolve.mock.calls[0][1]
    const result = resolveCallback({ path: 'https://example.com/test.mdx' })

    expect(result).toEqual({
      path: 'https://example.com/test.mdx',
      namespace: 'http-import'
    })
  })

  it('should handle HTTP import errors', async () => {
    const loadCallback = build.onLoad.mock.calls[1][1]
    const result = await loadCallback({ path: 'https://invalid-url/test.mdx' })

    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toContain('Error fetching remote content')
  })

  it('should cache HTTP responses', async () => {
    const loadCallback = build.onLoad.mock.calls[1][1]

    // First request
    await loadCallback({ path: 'https://example.com/test.mdx' })

    // Second request should use cache
    const result = await loadCallback({ path: 'https://example.com/test.mdx' })
    expect(result.loader).toBe('mdx')
  })
})
