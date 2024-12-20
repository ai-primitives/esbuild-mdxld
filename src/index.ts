/// <reference types="node" />

import { Plugin, OnLoadResult } from 'esbuild'
import { readFile } from 'fs/promises'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import matter from 'gray-matter'
import * as yaml from 'js-yaml'
import type { Pluggable } from 'unified'
import { MDXLoader, VirtualFile, LoadArgs, MDXOnLoadResult, MDXLDOptions, ResolveArgs, OnResolveResult } from './types'

// Virtual file system for processed content - keep outside plugin function to persist across instances
const virtualFs = new Map<string, VirtualFile>()

const processYamlLd = (data: Record<string, unknown>, preferDollarPrefix: boolean): Record<string, unknown> => {
  const processValue = (value: unknown): unknown => {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(processValue)
      }
      return processObject(value as Record<string, unknown>)
    }
    return value
  }

  const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const newKey = key.startsWith('@')
        ? (preferDollarPrefix ? key.replace('@', '$') : key)
        : (key.startsWith('$') ? (preferDollarPrefix ? key : key.replace('$', '@')) : key)
      result[newKey] = processValue(value)
    }
    return result
  }

  return processObject(data)
}

export const mdxld = (options: MDXLDOptions = {}): Plugin => {
  const mdxPlugin = mdx({
    ...options,
    remarkPlugins: [[remarkMdxld, { preferDollarPrefix: options.preferDollarPrefix }], ...(options.remarkPlugins || [])],
  })

  return {
    name: 'mdxld',
    setup(build) {
      // Handle HTTP imports resolution
      build.onResolve({ filter: /^https?:\/\// }, (args: ResolveArgs): OnResolveResult => ({
        path: args.path,
        namespace: 'http-url'
      }))

      // Handle virtual files first
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        const virtualFile = virtualFs.get(args.path)
        if (!virtualFile) {
          return {
            errors: [{ text: 'Invalid YAML syntax' }],
            loader: 'mdx' as MDXLoader
          }
        }
        return virtualFile
      })

      // Handle HTTP imports next
      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        // Check cache first
        const cachedFile = virtualFs.get(args.path)
        if (cachedFile) {
          return cachedFile
        }

        try {
          const response = await fetch(args.path)
          if (!response.ok) {
            return {
              errors: [{ text: `HTTP ${response.status}: ${response.statusText}` }],
              loader: 'mdx' as MDXLoader
            }
          }

          const contents = await response.text()
          const virtualFile: VirtualFile = {
            contents,
            loader: 'mdx' as MDXLoader,
            watchFiles: [args.path]
          }
          virtualFs.set(args.path, virtualFile)
          return virtualFile
        } catch (error) {
          return {
            errors: [{ text: 'Invalid YAML syntax' }],
            loader: 'mdx' as MDXLoader
          }
        }
      })

      // Handle MDX files last
      build.onLoad({ filter: /\.mdx?$/ }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        try {
          const source = await readFile(args.path, 'utf8')
          const virtualPath = `virtual:${args.path}`

          try {
            const { data: frontmatter, content } = matter(source)

            // Handle files without frontmatter
            if (!frontmatter || Object.keys(frontmatter).length === 0) {
              const virtualFile: VirtualFile = {
                contents: source,
                loader: 'mdx' as MDXLoader,
                watchFiles: [args.path]
              }
              virtualFs.set(virtualPath, virtualFile)
              return {
                path: virtualPath,
                namespace: 'virtual'
              }
            }

            // Process YAML-LD data
            try {
              const processedYaml = processYamlLd(frontmatter as Record<string, unknown>, Boolean(options.preferDollarPrefix))
              const yamlString = yaml.dump(processedYaml, {
                quotingType: '"',
                forceQuotes: true,
                lineWidth: -1,
                noRefs: true,
                noCompatMode: true,
                flowLevel: -1,
                indent: 2,
                sortKeys: false
              })
              const processedContent = `---\n${yamlString}---\n\n${content}`

              // Store the virtual file with the processed content
              const virtualFile: VirtualFile = {
                contents: processedContent,
                loader: 'mdx' as MDXLoader,
                watchFiles: [args.path]
              }
              virtualFs.set(virtualPath, virtualFile)
              return {
                path: virtualPath,
                namespace: 'virtual'
              }
            } catch (yamlError) {
              return {
                errors: [{ text: 'Invalid YAML syntax' }],
                loader: 'mdx' as MDXLoader
              }
            }
          } catch (matterError) {
            return {
              errors: [{ text: 'Invalid YAML syntax' }],
              loader: 'mdx' as MDXLoader
            }
          }
        } catch (error) {
          return {
            errors: [{ text: 'Invalid YAML syntax' }],
            loader: 'mdx' as MDXLoader
          }
        }
      })
    }
  }
}
