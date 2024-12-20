import { Plugin, PluginBuild, OnLoadArgs, OnLoadResult, OnResolveArgs, OnResolveResult } from 'esbuild'
import { vi, Mock } from 'vitest'

type HandlerMap = Map<string, (args: any) => Promise<any>>

interface MockWithHandlers<T extends (...args: any[]) => any> extends Mock<T> {
  handlers?: HandlerMap
}

// Minimal interface for test build object
interface BuildStub {
  onLoad: MockWithHandlers<(options: { filter: RegExp; namespace?: string }, callback: (args: OnLoadArgs) => Promise<OnLoadResult>) => void>
  onResolve: MockWithHandlers<(options: { filter: RegExp }, callback: (args: OnResolveArgs) => Promise<OnResolveResult>) => void>
  initialOptions: {
    fs?: {
      readFile: ReturnType<typeof vi.fn>
    }
  }
  esbuild: {
    version: string
    transform?: ReturnType<typeof vi.fn>
    build?: ReturnType<typeof vi.fn>
  }
  resolve?: (path: string, options?: { resolveDir?: string }) => Promise<{ path: string; namespace: string }>
}

export const createBuildStub = (): BuildStub => {
  const handlers = new Map()
  const onLoad = vi.fn((options: { filter: RegExp; namespace?: string }, callback: (args: OnLoadArgs) => Promise<OnLoadResult>) => {
    handlers.set(options.namespace || 'file', callback)
  }) as BuildStub['onLoad']
  onLoad.handlers = handlers

  const resolveHandlers = new Map()
  const onResolve = vi.fn((options: { filter: RegExp }, callback: (args: OnResolveArgs) => Promise<OnResolveResult>) => {
    resolveHandlers.set(options.filter.toString(), callback)
  }) as BuildStub['onResolve']
  onResolve.handlers = resolveHandlers

  return {
    onLoad,
    onResolve,
    initialOptions: {
      fs: {
        readFile: vi.fn(),
      },
    },
    esbuild: { version: '0.19.0' },
    resolve: async (path: string) => ({ path, namespace: 'file' }),
  }
}

export const setupTestPlugin = (plugin: Plugin): BuildStub => {
  const build = createBuildStub()
  plugin.setup(build as unknown as PluginBuild)
  return build
}
