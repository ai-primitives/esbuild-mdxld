import { Plugin, OnLoadResult, Loader } from 'esbuild'
import { readFile } from 'node:fs/promises'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type { Pluggable } from 'unified'

// PLACEHOLDER: rest of the file including types, interfaces, and implementation

// Define types for virtual file system
type MDXLoader = Extract<Loader, 'mdx' | 'js'>
interface VirtualFile {
  contents: string
  loader: MDXLoader
}

const httpCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Virtual file system for processed content
const virtualFs = new Map<string, VirtualFile>()

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
            virtualFs.set(args.path, { contents: cached.content, loader: 'mdx' as MDXLoader })
            return { contents: cached.content, loader: 'mdx' as MDXLoader }
          }

          const response = await fetch(args.path)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const content = await response.text()
          httpCache.set(args.path, { content, timestamp: Date.now() })
          virtualFs.set(args.path, { contents: content, loader: 'mdx' as MDXLoader })
          return { contents: content, loader: 'mdx' as MDXLoader }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Invalid YAML syntax'
          return { errors: [{ text: errorMessage }], loader: 'mdx' as MDXLoader }
        }
      })

      // Handle MDX files
      build.onLoad({ filter: /\.mdx?$/ }, async (args): Promise<OnLoadResult> => {
        try {
          const source = await readFile(args.path, 'utf8')
          const { data: frontmatter, content } = matter(source)

          // Process YAML-LD data
          const processedYaml = processYamlLd(frontmatter as Record<string, unknown>, Boolean(options.preferDollarPrefix))
          const enrichedContent = `---\n${yaml.dump(processedYaml)}\n---\n${content}`

          virtualFs.set(args.path, { contents: enrichedContent, loader: 'mdx' as MDXLoader })
          return { contents: enrichedContent, loader: 'mdx' as MDXLoader }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Invalid YAML syntax'
          return { errors: [{ text: errorMessage }], loader: 'mdx' as MDXLoader }
        }
      })

      // Handle virtual files
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args): Promise<OnLoadResult> => {
        const virtualFile = virtualFs.get(args.path)
        if (!virtualFile) {
          return { errors: [{ text: 'Virtual file not found' }], loader: 'mdx' as MDXLoader }
        }
        return virtualFile
      })
    },
  }
}
