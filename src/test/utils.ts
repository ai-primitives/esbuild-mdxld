import { Plugin, PluginBuild } from 'esbuild'
import { vi } from 'vitest'

// Minimal interface for test build object
interface BuildStub {
  onLoad: ReturnType<typeof vi.fn>
  onResolve: ReturnType<typeof vi.fn>
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
  const onLoad = vi.fn()
  const onResolve = vi.fn()

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
