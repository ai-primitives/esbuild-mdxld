import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mdxld } from '../index'
import type { Plugin, PluginBuild } from 'esbuild'

type MockFunction<T> = T & ReturnType<typeof vi.fn>
interface MockPluginBuild extends PluginBuild {
  onLoad: MockFunction<PluginBuild['onLoad']>
  onResolve: MockFunction<PluginBuild['onResolve']>
  initialOptions: Record<string, unknown>
}

describe('HTTP import resolution', () => {
  let plugin: Plugin
  let build: MockPluginBuild

  beforeEach(() => {
    plugin = mdxld({
      httpTimeout: 5000,
      httpCacheTTL: 1000,
    })
    build = {
      onLoad: vi.fn(),
      onResolve: vi.fn(),
      initialOptions: {},
      esbuild: { version: '0.19.0' },
      resolve: async (path: string) => ({ path, namespace: 'file' }),
      warn: vi.fn(),
      error: vi.fn(),
      write: vi.fn(),
      watch: vi.fn(),
      dispose: vi.fn(),
      serve: vi.fn(),
      rebuild: vi.fn(),
      metafile: {},
    } as unknown as MockPluginBuild
    plugin.setup(build)
  })

  it('should resolve HTTP URLs in namespace', () => {
    const resolveCallback = build.onResolve.mock.calls[0][1]
    const result = resolveCallback({ path: 'https://example.com/test.mdx' })

    expect(result).toEqual({
      path: 'https://example.com/test.mdx',
      namespace: 'http-import',
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