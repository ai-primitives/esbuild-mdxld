/// <reference types="node" />

import { Plugin, PluginBuild } from 'esbuild'
import { promises as fsPromises } from 'fs'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import { MDXLoader, VirtualFile, LoadArgs, MDXOnLoadResult, MDXLDOptions, ResolveArgs, OnResolveResult } from './types'

// Virtual file system for processed content - keep outside plugin function to persist across instances
const virtualFs = new Map<string, VirtualFile>()

const processYamlLd = (data: Record<string, unknown>, preferDollarPrefix: boolean): Record<string, unknown> => {
  const processValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(processValue)
    }
    if (typeof value === 'object' && value !== null) {
      return processObject(value as Record<string, unknown>)
    }
    return value
  }

  const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      let newKey = key
      if (key.startsWith('@') && preferDollarPrefix) {
        newKey = `$${key.slice(1)}`
      } else if (key.startsWith('$') && !preferDollarPrefix) {
        newKey = `@${key.slice(1)}`
      }
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

      // Handle file namespace first
      build.onLoad({ filter: /\.mdx?$/, namespace: 'file' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        try {
          const contents = await fsPromises.readFile(args.path, 'utf8')
          try {
            const { data: frontmatter, content } = matter(contents)

            // Handle files without frontmatter or empty frontmatter
            if (!frontmatter || Object.keys(frontmatter).length === 0) {
              const virtualPath = `virtual:${args.path}`
              const virtualFile: VirtualFile = {
                contents: contents, // Use original contents for files without frontmatter
                loader: 'mdx' as MDXLoader,
                watchFiles: [args.path]
              }
              virtualFs.set(virtualPath, virtualFile)
              return {
                path: virtualPath,
                namespace: 'virtual',
                watchFiles: [args.path]
              }
            }

            try {
              // Process YAML-LD data
              const processedYaml = processYamlLd(frontmatter, Boolean(options.preferDollarPrefix))
              console.log('Processed YAML:', processedYaml)

              // Convert processed YAML back to string
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

              // Create virtual file path and content
              const virtualPath = `virtual:${args.path}`
              const processedContent = `---\n${yamlString}---\n\n${content}`

              // Store the virtual file
              const virtualFile: VirtualFile = {
                contents: processedContent,
                loader: 'mdx' as MDXLoader,
                watchFiles: [args.path]
              }
              virtualFs.set(virtualPath, virtualFile)
              console.log('Stored virtual file:', virtualFile)

              return {
                path: virtualPath,
                namespace: 'virtual',
                watchFiles: [args.path]
              }
            } catch (yamlError) {
              console.error('YAML processing error:', yamlError)
              return {
                errors: [{ text: 'Invalid YAML syntax' }],
                loader: 'mdx' as MDXLoader
              }
            }
          } catch (matterError) {
            console.error('Matter parsing error:', matterError)
            return {
              errors: [{ text: 'Invalid YAML syntax' }],
              loader: 'mdx' as MDXLoader
            }
          }
        } catch (error) {
          console.error('File read error:', error)
          return {
            errors: [{ text: 'Failed to read file' }],
            loader: 'mdx' as MDXLoader
          }
        }
      })

      // Handle virtual files next
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        console.log('Virtual file handler called with path:', args.path)
        console.log('Virtual files in map:', Array.from(virtualFs.keys()))
        const virtualFile = virtualFs.get(args.path)
        if (!virtualFile) {
          console.log('Virtual file not found')
          return {
            errors: [{ text: `Virtual file not found: ${args.path}` }],
            loader: 'mdx' as MDXLoader
          }
        }
        console.log('Found virtual file:', virtualFile)
        return virtualFile
      })

      // Handle HTTP imports last
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
            errors: [{ text: error instanceof Error ? error.message : 'Failed to fetch' }],
            loader: 'mdx' as MDXLoader
          }
        }
      })
    }
  }
}
