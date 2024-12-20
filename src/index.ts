/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference types="node" />

import { Plugin, OnLoadResult } from 'esbuild'
import { readFile } from 'fs/promises'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import matter from 'gray-matter'
import * as yaml from 'js-yaml'
import type { Pluggable } from 'unified'
import { MDXLoader, VirtualFile, LoadArgs } from './types'

// Virtual file system for processed content
const virtualFs = new Map<string, VirtualFile>()

export interface MDXLDOptions {
  jsxImportSource?: string
  providerImports?: Record<string, string>
  preferDollarPrefix?: boolean
  httpCacheTTL?: number
  httpTimeout?: number
  remarkPlugins?: Pluggable[]
  rehypePlugins?: Pluggable[]
}

const processYamlLd = (data: Record<string, unknown>, preferDollarPrefix: boolean): Record<string, unknown> => {
  const processValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(processValue)
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value as Record<string, unknown>)
      return Object.fromEntries(
        entries.map(([key, val]) => {
          const isJsonLdKey = ['type', 'context', 'id'].includes(key.toLowerCase())
          const prefix = preferDollarPrefix ? '$' : '@'
          const newKey = isJsonLdKey ? `${prefix}${key}` : key
          return [newKey, processValue(val)]
        }),
      )
    }
    return value
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      const isJsonLdKey = ['type', 'context', 'id'].includes(key.toLowerCase())
      const prefix = preferDollarPrefix ? '$' : '@'
      const newKey = isJsonLdKey ? `${prefix}${key}` : key
      return [newKey, processValue(value)]
    }),
  )
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
      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args: LoadArgs): Promise<OnLoadResult> => {
        try {
          const cachedFile = virtualFs.get(args.path)
          if (cachedFile) {
            return {
              contents: cachedFile.contents,
              loader: cachedFile.loader,
            }
          }

          const response = await fetch(args.path)
          if (!response.ok) {
            return {
              errors: [{ text: `HTTP ${response.status}: ${response.statusText}` }],
              loader: 'mdx' as MDXLoader,
            }
          }

          const contents = await response.text()
          const virtualFile = { contents, loader: 'mdx' as MDXLoader }
          virtualFs.set(args.path, virtualFile)
          return {
            contents,
            loader: 'mdx' as MDXLoader,
          }
        } catch (error) {
          return {
            errors: [{ text: error instanceof Error ? error.message : 'Failed to fetch remote content' }],
            loader: 'mdx' as MDXLoader,
          }
        }
      })

      // Handle MDX files
      build.onLoad({ filter: /\.mdx?$/ }, async (args): Promise<OnLoadResult> => {
        try {
          const source = await readFile(args.path, 'utf8')

          try {
            const { data: frontmatter, content } = matter(source)

            // Handle files without frontmatter
            if (!frontmatter || Object.keys(frontmatter).length === 0) {
              const virtualFile = { contents: source, loader: 'mdx' as MDXLoader }
              virtualFs.set(args.path, virtualFile)
              return { contents: source, loader: 'mdx' as MDXLoader }
            }

            // Process YAML-LD data
            const processedYaml = processYamlLd(frontmatter as Record<string, unknown>, Boolean(options.preferDollarPrefix))
            const enrichedContent = `---\n${yaml.dump(processedYaml)}\n---\n${content}`
            const virtualFile = { contents: enrichedContent, loader: 'mdx' as MDXLoader }
            virtualFs.set(args.path, virtualFile)
            return { contents: enrichedContent, loader: 'mdx' as MDXLoader }
          } catch (error) {
            return {
              errors: [{ text: 'Invalid YAML syntax' }],
              loader: 'mdx' as MDXLoader,
            }
          }
        } catch (error) {
          return {
            errors: [{ text: error instanceof Error ? error.message : 'Cannot process MDX file with esbuild' }],
            loader: 'mdx' as MDXLoader,
          }
        }
      })

      // Handle virtual files
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: LoadArgs): Promise<OnLoadResult> => {
        const virtualFile = virtualFs.get(args.path)
        if (!virtualFile) {
          return {
            errors: [{ text: `Virtual file not found: ${args.path}` }],
            loader: 'mdx' as MDXLoader,
          }
        }
        return {
          contents: virtualFile.contents,
          loader: virtualFile.loader,
        }
      })
    },
  }
}

export default mdxld
