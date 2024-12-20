/// <reference lib="dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mdxld } from '../index'
import { createBuildStub } from './utils'
import { mocks } from './setup'
import type { PluginBuild } from 'esbuild'

describe('mdxld plugin - HTTP imports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockImplementation(async () => {
      return new (mocks.Response as typeof Response)('Test content', {
        status: 200,
        statusText: 'OK',
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve HTTP imports', async () => {
    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build as unknown as PluginBuild)

    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]
    const result = await callback({ path: 'https://example.com/test.mdx' })

    expect(result.contents).toBe('Test content')
    expect(result.loader).toBe('mdx')
    expect(mocks.fetch).toHaveBeenCalled()
  })

  it('should handle HTTP import errors', async () => {
    mocks.fetch.mockImplementation(async () => {
      return new (mocks.Response as typeof Response)(null, {
        status: 404,
        statusText: 'Not Found',
      })
    })

    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build as unknown as PluginBuild)

    const { onLoad } = build
    const callback = onLoad.mock.calls[1][1]
    const result = await callback({ path: 'https://example.com/not-found.mdx' })

    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mocks.fetch).toHaveBeenCalled()
  })

  it('should cache HTTP responses', async () => {
    const responses = ['Response 1', 'Response 2']
    let callCount = 0

    mocks.fetch.mockImplementation(async () => {
      return new (mocks.Response as typeof Response)(responses[callCount++], {
        status: 200,
        statusText: 'OK',
      })
    })

    const plugin = mdxld()
    const build = createBuildStub()
    plugin.setup(build as unknown as PluginBuild)

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
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
