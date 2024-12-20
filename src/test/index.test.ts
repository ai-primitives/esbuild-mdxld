import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Plugin } from 'esbuild'
import { mdxld } from '../index'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { createBuildStub, setupTestPlugin, MockWithHandlers } from './utils'
import type { ExtendedOnLoadResult } from './http-import.test'

vi.mock('node:fs/promises')

describe('mdxld plugin', () => {
  let plugin: Plugin
  let build: ReturnType<typeof createBuildStub>
  const examplesDir = path.join(process.cwd(), 'examples')

  beforeEach(() => {
    vi.resetAllMocks()
    plugin = mdxld({
      preferDollarPrefix: false,
    })
    build = setupTestPlugin(plugin)
  })

  const getHandlerForNamespace = (namespace: string) => {
    return (build.onLoad as MockWithHandlers<typeof build.onLoad>).handlers?.get(namespace)
  }

  it('should create a plugin with default options', () => {
    expect(plugin.name).toBe('mdxld')
    expect(build.onResolve).toHaveBeenCalled()
    expect(build.onLoad).toHaveBeenCalled()
  })

  describe('YAML-LD parsing with @ prefix', () => {
    it('should process basic string values', async () => {
      const mdxPath = path.join(examplesDir, 'basic/at-prefix.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      const virtualPath = result.path || ''
      const virtualCallback = getHandlerForNamespace('virtual')
      expect(virtualCallback).toBeDefined()
      if (!virtualCallback) throw new Error('Virtual handler not found')

      const virtualResult = (await virtualCallback({
        path: virtualPath,
        namespace: 'virtual',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(virtualResult.contents).toBeDefined()
      expect(typeof virtualResult.contents === 'string').toBe(true)
      const contents = virtualResult.contents as string
      expect(contents).toContain('"@context": "https://schema.org"')
      expect(contents).toContain('"@type": "BlogPosting"')
      expect(contents).toContain('"title": "Understanding YAML-LD in MDX"')
      expect(virtualResult.loader).toBe('mdx')
    })

    it('should process numeric values and nested objects', async () => {
      const mdxPath = path.join(examplesDir, 'basic/dollar-prefix.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      const virtualPath = result.path || ''
      const virtualCallback = getHandlerForNamespace('virtual')
      expect(virtualCallback).toBeDefined()
      if (!virtualCallback) throw new Error('Virtual handler not found')

      const virtualResult = (await virtualCallback({
        path: virtualPath,
        namespace: 'virtual',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(virtualResult.contents).toBeDefined()
      expect(typeof virtualResult.contents === 'string').toBe(true)
      const contents = virtualResult.contents as string
      expect(contents).toContain('"$type": "Product"')
      expect(contents).toContain('"price": 29.99')
      expect(contents).toContain('"availability": "InStock"')
      expect(virtualResult.loader).toBe('mdx')
    })
  })

  describe('YAML-LD parsing with complex structures', () => {
    it('should process nested objects and arrays', async () => {
      const mdxPath = path.join(examplesDir, 'complex/nested-data.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      const virtualPath = result.path || ''
      const virtualCallback = getHandlerForNamespace('virtual')
      expect(virtualCallback).toBeDefined()
      if (!virtualCallback) throw new Error('Virtual handler not found')

      const virtualResult = (await virtualCallback({
        path: virtualPath,
        namespace: 'virtual',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(virtualResult.contents).toBeDefined()
      expect(typeof virtualResult.contents === 'string').toBe(true)
      const contents = virtualResult.contents as string
      expect(contents).toContain('"$type": "Event"')
      expect(contents).toContain('"$type": "Place"')
      expect(contents).toContain('"$type": "Person"')
      expect(contents).toContain('"topics": ["AI", "Machine Learning"]')
      expect(virtualResult.loader).toBe('mdx')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid YAML syntax', async () => {
      const mdxPath = path.join(examplesDir, 'errors/invalid-yaml.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(result.errors).toBeDefined()
      expect(result.errors![0].text).toBe('Invalid YAML syntax')
      expect(result.loader).toBe('mdx')
    })

    it('should handle missing frontmatter', async () => {
      const mdxPath = path.join(examplesDir, 'errors/no-frontmatter.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      const virtualPath = result.path || ''
      const virtualCallback = getHandlerForNamespace('virtual')
      expect(virtualCallback).toBeDefined()
      if (!virtualCallback) throw new Error('Virtual handler not found')

      const virtualResult = (await virtualCallback({
        path: virtualPath,
        namespace: 'virtual',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(virtualResult.contents).toBe(content)
      expect(virtualResult.loader).toBe('mdx')
    })

    it('should handle empty frontmatter', async () => {
      const mdxPath = path.join(examplesDir, 'errors/empty-frontmatter.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = getHandlerForNamespace('file')
      expect(loadCallback).toBeDefined()
      if (!loadCallback) throw new Error('File handler not found')

      const result = (await loadCallback({
        path: mdxPath,
        namespace: 'file',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      const virtualPath = result.path || ''
      const virtualCallback = getHandlerForNamespace('virtual')
      expect(virtualCallback).toBeDefined()
      if (!virtualCallback) throw new Error('Virtual handler not found')

      const virtualResult = (await virtualCallback({
        path: virtualPath,
        namespace: 'virtual',
        suffix: '',
        pluginData: null,
        with: {},
        resolveDir: '/',
        kind: 'entry-point',
        importer: '',
      })) as ExtendedOnLoadResult

      expect(virtualResult.contents).toBe(content)
      expect(virtualResult.loader).toBe('mdx')
    })
  })
})
