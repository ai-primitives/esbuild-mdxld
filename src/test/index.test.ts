import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Plugin } from 'esbuild'
import { mdxld } from '../index'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { createBuildStub, setupTestPlugin } from './utils'

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

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })
      const virtualPath = result.path

      const virtualCallback = build.onLoad.mock.calls[2][1]
      const virtualResult = await virtualCallback({ path: virtualPath, namespace: 'virtual' })

      expect(virtualResult.contents).toBeDefined()
      expect(virtualResult.contents).toContain('"@context": "https://schema.org"')
      expect(virtualResult.contents).toContain('"@type": "BlogPosting"')
      expect(virtualResult.contents).toContain('"title": "Understanding YAML-LD in MDX"')
      expect(virtualResult.loader).toBe('mdx')
    })

    it('should process numeric values and nested objects', async () => {
      const mdxPath = path.join(examplesDir, 'basic/dollar-prefix.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })
      const virtualPath = result.path

      const virtualCallback = build.onLoad.mock.calls[2][1]
      const virtualResult = await virtualCallback({ path: virtualPath, namespace: 'virtual' })

      expect(virtualResult.contents).toBeDefined()
      expect(virtualResult.contents).toContain('"$type": "Product"')
      expect(virtualResult.contents).toContain('"price": 29.99')
      expect(virtualResult.contents).toContain('"availability": "InStock"')
      expect(virtualResult.loader).toBe('mdx')
    })
  })

  describe('YAML-LD parsing with complex structures', () => {
    it('should process nested objects and arrays', async () => {
      const mdxPath = path.join(examplesDir, 'complex/nested-data.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })
      const virtualPath = result.path

      const virtualCallback = build.onLoad.mock.calls[2][1]
      const virtualResult = await virtualCallback({ path: virtualPath, namespace: 'virtual' })

      expect(virtualResult.contents).toBeDefined()
      expect(JSON.stringify(virtualResult.contents)).toContain('"$type": "Event"')
      expect(JSON.stringify(virtualResult.contents)).toContain('"$type": "Place"')
      expect(JSON.stringify(virtualResult.contents)).toContain('"$type": "Person"')
      expect(JSON.stringify(virtualResult.contents)).toContain('"topics": ["AI","Machine Learning"]')
      expect(virtualResult.loader).toBe('mdx')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid YAML syntax', async () => {
      const mdxPath = path.join(examplesDir, 'errors/invalid-yaml.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })

      expect(result.errors).toBeDefined()
      expect(result.errors[0].text).toBe('Invalid YAML syntax')
      expect(result.loader).toBe('mdx')
    })

    it('should handle missing frontmatter', async () => {
      const mdxPath = path.join(examplesDir, 'errors/no-frontmatter.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })
      const virtualPath = result.path

      const virtualCallback = build.onLoad.mock.calls[2][1]
      const virtualResult = await virtualCallback({ path: virtualPath, namespace: 'virtual' })

      expect(virtualResult.contents).toBe(content)
      expect(virtualResult.loader).toBe('mdx')
    })

    it('should handle empty frontmatter', async () => {
      const mdxPath = path.join(examplesDir, 'errors/empty-frontmatter.mdx')
      const content = await fs.readFile(mdxPath, 'utf8')
      vi.mocked(fs.readFile).mockResolvedValue(content)

      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: mdxPath, namespace: 'file' })
      const virtualPath = result.path

      const virtualCallback = build.onLoad.mock.calls[2][1]
      const virtualResult = await virtualCallback({ path: virtualPath, namespace: 'virtual' })

      expect(virtualResult.contents).toBe(content)
      expect(virtualResult.loader).toBe('mdx')
    })
  })
})
