import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mdxld } from '../index'
import type { Plugin, PluginBuild } from 'esbuild'
import fs from 'node:fs/promises'

type MockFunction<T> = T & ReturnType<typeof vi.fn>
interface MockPluginBuild extends PluginBuild {
  onLoad: MockFunction<PluginBuild['onLoad']>
  onResolve: MockFunction<PluginBuild['onResolve']>
  initialOptions: Record<string, unknown>
}

describe('mdxld plugin', () => {
  let plugin: Plugin
  let build: MockPluginBuild

  beforeEach(() => {
    vi.clearAllMocks()
    plugin = mdxld({
      validateRequired: true,
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

  it('should create a plugin with default options', () => {
    const plugin = mdxld()
    expect(plugin.name).toBe('mdxld')
    expect(plugin.setup).toBeInstanceOf(Function)
  })

  describe('YAML-LD parsing with @ prefix', () => {
    it('should process basic string values', async () => {
      const mdxContent = `---
@context: https://schema.org
@type: BlogPosting
@id: https://example.com/post-1
title: Test Post
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toContain('"context": "https://schema.org"')
      expect(result.contents).toContain('"type": "BlogPosting"')
    })

    it('should process numeric values', async () => {
      const mdxContent = `---
@context: https://schema.org
@type: Product
price: 99.99
rating:
  @type: Rating
  ratingValue: 4.5
  reviewCount: 100
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toContain('"ratingValue": 4.5')
      expect(result.contents).toContain('"reviewCount": 100')
    })

    it('should process array values', async () => {
      const mdxContent = `---
@context: https://schema.org
@type: BlogPosting
keywords:
  - javascript
  - typescript
  - mdx
author:
  @type: Person
  name: John Doe
  sameAs:
    - https://twitter.com/johndoe
    - https://github.com/johndoe
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toContain('"keywords":')
      expect(result.contents).toContain('"javascript"')
      expect(result.contents).toContain('"sameAs":')
    })
  })

  describe('YAML-LD parsing with $ prefix', () => {
    it('should process nested objects with $ prefix', async () => {
      const mdxContent = `---
$context: https://schema.org
$type: Article
author:
  $type: Person
  name: Jane Smith
  address:
    $type: PostalAddress
    streetAddress: 123 Main St
    addressLocality: Springfield
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toContain('"type": "Person"')
      expect(result.contents).toContain('"type": "PostalAddress"')
      expect(result.contents).toContain('"streetAddress"')
    })

    it('should handle mixed $ and regular properties', async () => {
      const mdxContent = `---
$context: https://schema.org
$type: Product
name: Cool Product
offers:
  $type: Offer
  price: 29.99
  priceCurrency: USD
  availability: InStock
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toContain('"type": "Offer"')
      expect(result.contents).toContain('"price": 29.99')
      expect(result.contents).toContain('"availability": "InStock"')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid YAML syntax', async () => {
      const mdxContent = `---
@context: https://schema.org
@type: [Invalid[Syntax
---
# Content
`
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.errors).toBeDefined()
      expect(result.errors[0].text).toContain('Error processing MDX file')
    })

    it('should handle missing frontmatter', async () => {
      const mdxContent = '# Just content without frontmatter'
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(mdxContent)
      const loadCallback = build.onLoad.mock.calls[0][1]
      const result = await loadCallback({ path: 'test.mdx' })
      expect(result.contents).toBe(mdxContent)
      expect(result.loader).toBe('mdx')
    })
  })
})
