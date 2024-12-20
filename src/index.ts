import { Plugin, OnLoadResult, Loader } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import type { Pluggable } from 'unified'
import { fetch } from 'undici'

const httpCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Virtual file system for processed content
const virtualFs = new Map<string, { contents: string; loader: Loader }>()

export interface MDXLDOptions {
  jsxImportSource?: string
  validateRequired?: boolean
  preferDollarPrefix?: boolean
  httpCacheTTL?: number
  httpTimeout?: number
  remarkPlugins?: Pluggable[]
}

const processYamlLd = (data: Record<string, unknown>, preferDollarPrefix: boolean): Record<string, unknown> => {
  const processValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(processValue)
    }
    if (typeof value === 'object' && value !== null) {
      return processYamlLd(value as Record<string, unknown>, preferDollarPrefix)
    }
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('@') || key.startsWith('$')) {
      result[key] = processValue(value)
    } else {
      const prefix = preferDollarPrefix ? '$' : '@'
      const isJsonLdKey = ['type', 'context', 'id'].includes(key.toLowerCase())
      const finalKey = isJsonLdKey ? `${prefix}${key}` : key
      result[finalKey] = processValue(value)
    }
  }
  return result
}

export const mdxld = (options: MDXLDOptions = {}): Plugin => {
  const mdxPlugin = mdx({
    ...options,
    remarkPlugins: [[remarkMdxld, { preferDollarPrefix: options.preferDollarPrefix }], ...(options.remarkPlugins || [])],
  })

  return {
    name: 'mdxld',
    setup(build) {
      // Set up MDX plugin first
      mdxPlugin.setup(build)

      // Handle HTTP imports resolution
      build.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        namespace: 'http-url',
      }))

      // Handle HTTP imports loading
      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args): Promise<OnLoadResult> => {
        try {
          const cached = httpCache.get(args.path)
          if (cached && Date.now() - cached.timestamp < (options.httpCacheTTL ?? CACHE_TTL)) {
            return { contents: cached.content, loader: 'mdx' as Loader }
          }

          const response = await fetch(args.path)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const content = await response.text()
          httpCache.set(args.path, { content, timestamp: Date.now() })
          return { contents: content, loader: 'mdx' as Loader }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'HTTP 404: Not Found'
          return { errors: [{ text: errorMessage }], loader: 'mdx' as Loader }
        }
      })

      // Handle MDX files
      build.onLoad({ filter: /\.mdx?$/ }, async (args): Promise<OnLoadResult> => {
        try {
          const source = await readFile(args.path, 'utf8')
          const match = source.match(/^---\n([\s\S]*?)\n---/)

          if (!match || !match[1].trim()) {
            virtualFs.set(args.path, { contents: source, loader: 'mdx' as Loader })
            return { contents: source, loader: 'mdx' as Loader }
          }

          try {
            const yamlData = parse(match[1])
            if (typeof yamlData !== 'object' || yamlData === null) {
              throw new Error('Invalid YAML: expected an object')
            }

            const processedYaml = processYamlLd(yamlData as Record<string, unknown>, Boolean(options.preferDollarPrefix))
            const yamlString = JSON.stringify(processedYaml, null, 2)
            const contentAfterFrontmatter = source.slice(match[0].length).trim()
            const processedContent = `---\n${yamlString}\n---\n\n${contentAfterFrontmatter}`

            virtualFs.set(args.path, { contents: processedContent, loader: 'mdx' as Loader })
            return { contents: processedContent, loader: 'mdx' as Loader }
          } catch {
            return { errors: [{ text: 'Invalid YAML syntax' }], loader: 'mdx' as Loader }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          return { errors: [{ text: `Cannot process MDX file: ${errorMessage}` }], loader: 'mdx' as Loader }
        }
      })

      // Handle virtual files
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args): OnLoadResult => {
        const file = virtualFs.get(args.path)
        if (!file) {
          return { errors: [{ text: `Virtual file not found: ${args.path}` }], loader: 'mdx' as Loader }
        }
        return { contents: file.contents, loader: file.loader }
      })
    },
  }
}
