import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Plugin, PluginBuild } from 'esbuild'
import { mdxld } from '../index'
import * as https from 'node:https'
import { IncomingMessage, ClientRequest } from 'node:http'
import { Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import { Buffer } from 'node:buffer'

// Using Vitest's built-in globals
vi.stubGlobal('fetch', vi.fn())
vi.stubGlobal('setTimeout', vi.fn())

vi.mock('node:https')

interface MockPluginBuild extends PluginBuild {
  onLoad: ReturnType<typeof vi.fn>
  onResolve: ReturnType<typeof vi.fn>
  initialOptions: Record<string, unknown>
}

class MockClientRequest extends EventEmitter implements Partial<ClientRequest> {
  constructor() {
    super()
  }

  // Required methods from ClientRequest
  setTimeout = vi.fn().mockImplementation((timeout: number, callback?: () => void) => {
    if (callback) {
      vi.fn()(callback, timeout)
    }
    return this
  })
  end = vi.fn().mockImplementation(() => {
    return this
  })
  destroy = vi.fn().mockImplementation(() => {
    return this
  })
  write = vi.fn().mockImplementation(() => {
    return true
  })
  abort = vi.fn()

  // Required properties
  aborted = false
  destroyed = false
  writableEnded = false
  writableFinished = false
  readable = true
  writable = true

  // Stream properties
  writableHighWaterMark = 16384
  writableLength = 0
  writableObjectMode = false
  writableCorked = 0
  closed = false
  errored = null

  // HTTP-specific properties
  method = 'GET'
  path = '/'
  host = 'localhost'
  protocol = 'https:'
  maxHeadersCount = 2000
  reusedSocket = false
  socket = new Socket()
  connection = new Socket()
  headersSent = false
  chunkedEncoding = false
  shouldKeepAlive = true
  useChunkedEncodingByDefault = true
  sendDate = true
  finished = false

  // Event emitter methods
  addListener = vi.fn().mockReturnThis()
  on = vi.fn().mockReturnThis()
  once = vi.fn().mockReturnThis()
  removeListener = vi.fn().mockReturnThis()
  off = vi.fn().mockReturnThis()
  removeAllListeners = vi.fn().mockReturnThis()
  setMaxListeners = vi.fn().mockReturnThis()
  getMaxListeners = vi.fn()
  listeners = vi.fn()
  rawListeners = vi.fn()
  emit = vi.fn()
  listenerCount = vi.fn()
  prependListener = vi.fn().mockReturnThis()
  prependOnceListener = vi.fn().mockReturnThis()
  eventNames = vi.fn()

  // Additional required methods
  pipe = vi.fn()
  unpipe = vi.fn()
  setNoDelay = vi.fn()
  setSocketKeepAlive = vi.fn()
  setHeader = vi.fn()
  getHeader = vi.fn()
  removeHeader = vi.fn()
  addTrailers = vi.fn()
  flushHeaders = vi.fn()
}

describe('mdxld plugin - HTTP imports', () => {
  let plugin: Plugin
  let build: MockPluginBuild

  beforeEach(() => {
    vi.resetAllMocks()
    plugin = mdxld({
      validateRequired: true,
      httpTimeout: 5000,
    })
    build = {
      onResolve: vi.fn(),
      onLoad: vi.fn(),
      initialOptions: {},
      esbuild: { version: '0.19.0' },
      resolve: async (path: string) => ({ path, namespace: 'file' }),
    } as unknown as MockPluginBuild
    plugin.setup(build)
  })

  it('should resolve HTTP imports', async () => {
    const resolveCallback = build.onResolve.mock.calls[0][1]
    const result = await resolveCallback({ path: 'https://example.com/content.mdx' })

    expect(result.namespace).toBe('http-import')
    expect(result.path).toBe('https://example.com/content.mdx')
  })

  it('should handle HTTP import errors', async () => {
    const mockGet = vi.spyOn(https, 'get').mockImplementation((url, options, callback) => {
      const cb = typeof options === 'function' ? options : callback
      const req = new MockClientRequest()

      if (typeof cb === 'function') {
        const mockResponse = new EventEmitter() as IncomingMessage
        Object.assign(mockResponse, {
          statusCode: 404,
          statusMessage: 'Not Found',
          socket: new Socket(),
        })

        process.nextTick(() => {
          cb(mockResponse)
          mockResponse.emit('end')
        })
      }

      return req as unknown as ClientRequest
    })

    const loadCallback = build.onLoad.mock.calls[1][1] // Get the http-import namespace handler
    const result = await loadCallback({ path: 'https://example.com/not-found.mdx', namespace: 'http-import' })

    expect(result.errors).toBeDefined()
    expect(result.errors[0].text).toBe('HTTP 404: Not Found')
    expect(result.loader).toBe('mdx')
    expect(mockGet).toHaveBeenCalled()
  })

  it('should cache HTTP responses', async () => {
    const mockGet = vi.spyOn(https, 'get').mockImplementation((url, options, callback) => {
      const cb = typeof options === 'function' ? options : callback
      const req = new MockClientRequest()

      if (typeof cb === 'function') {
        const mockResponse = new EventEmitter() as IncomingMessage
        Object.assign(mockResponse, {
          statusCode: 200,
          statusMessage: 'OK',
          socket: new Socket(),
        })

        process.nextTick(() => {
          cb(mockResponse)
          mockResponse.emit('data', Buffer.from('Response 1'))
          mockResponse.emit('end')
        })
      }

      return req as unknown as ClientRequest
    })

    const loadCallback = build.onLoad.mock.calls[1][1] // Get the http-import namespace handler

    // First request - test caching behavior
    await loadCallback({ path: 'https://example.com/cached.mdx', namespace: 'http-import' })

    // Get virtual file content
    const virtualCallback = build.onLoad.mock.calls[2][1] // Get the virtual namespace handler
    const virtualResult = await virtualCallback({ path: 'https://example.com/cached.mdx', namespace: 'virtual' })

    expect(virtualResult.contents).toBe('Response 1')
    expect(virtualResult.loader).toBe('mdx')

    // Second request (should use cache)
    const result2 = await loadCallback({ path: 'https://example.com/cached.mdx', namespace: 'http-import' })
    const virtualPath2 = result2.path

    const virtualResult2 = await virtualCallback({ path: virtualPath2, namespace: 'virtual' })
    expect(virtualResult2.contents).toBe('Response 1')
    expect(virtualResult2.loader).toBe('mdx')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
