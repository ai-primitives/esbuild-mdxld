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

function preprocessYaml(content: string): string {
  let processed = content
    .replace(/^(@\w+):/gm, '__at__$1:')
    .replace(/(\s+)(@\w+):/g, '$1__at__$2:')

  const lines = processed.split('\n')
  const result = []
  let currentIndent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(\s*)(author|creator|publisher):\s*(@\w+):(.*)$/)
    if (match) {
      const [, indent, key, type, rest] = match
      currentIndent = indent
      result.push(`${indent}${key}:`)
      result.push(`${indent}  __at__${type}:${rest}`)
    } else if (line.trim().startsWith('@')) {
      result.push(currentIndent + '__at__' + line.trim())
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function postprocessYaml(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(item => postprocessYaml(item))
  }

  if (typeof data !== 'object' || data === null) {
    return data
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const processedKey = key.replace(/^__at__@/, '@')
    result[processedKey] = postprocessYaml(value)
  }
  return result
}

function parseYamlContent(content: string): Record<string, unknown> {
  try {
    const preprocessed = preprocessYaml(content)
    const parsed = yaml.load(preprocessed) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid YAML: must be an object')
    }
    return postprocessYaml(parsed) as Record<string, unknown>
  } catch (error) {
    console.error('YAML parsing error:', error)
    throw error
  }
}

function processYamlLd(data: Record<string, unknown>, preferDollarPrefix: boolean): Record<string, unknown> {
  function processValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return processObject(item as Record<string, unknown>)
        }
        return item
      })
    }
    if (typeof value === 'object' && value !== null) {
      return processObject(value as Record<string, unknown>)
    }
    return value
  }

  function processObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      let newKey = key
      if (preferDollarPrefix && key.startsWith('@')) {
        newKey = `$${key.slice(1)}`
      }
      result[newKey] = processValue(value)
    }
    return result
  }

  return processObject(data)
}

function formatJsonString(obj: Record<string, unknown>): string {
  function formatValue(value: unknown): string {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return `[${value.map(formatValue).join(', ')}]`
      }
      const entries = Object.entries(value).map(([k, v]) => `"${k}": ${formatValue(v)}`)
      return `{\n${entries.map(e => '  ' + e).join(',\n')}\n}`
    }
    return JSON.stringify(value)
  }

  const entries = Object.entries(obj).map(([key, value]) => `"${key}": ${formatValue(value)}`)
  return `{\n${entries.join(',\n')}\n}`
}

export const mdxld = (options: MDXLDOptions = {}): Plugin => {
  const mdxPlugin = mdx({
    ...options,
    remarkPlugins: [[remarkMdxld, { preferDollarPrefix: options.preferDollarPrefix }], ...(options.remarkPlugins || [])],
  })

  return {
    name: 'mdxld',
    setup(build) {
      build.onResolve({ filter: /^https?:\/\// }, (args: ResolveArgs): OnResolveResult => ({
        path: args.path,
        namespace: 'http-url'
      }))

      build.onLoad({ filter: /\.mdx?$/, namespace: 'file' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        try {
          const contents = await fsPromises.readFile(args.path, 'utf8')
          const virtualPath = `virtual:${args.path}`

          const matches = contents.match(/^---\n([\s\S]*?)\n---/)
          if (!matches || !matches[1].trim()) {
            return {
              contents,
              loader: 'mdx' as MDXLoader
            }
          }

          try {
            const frontmatter = parseYamlContent(matches[1])

            const processedYaml = processYamlLd(frontmatter, options?.preferDollarPrefix ?? false)

            const processedContent = formatJsonString(processedYaml)

            const virtualFile: MDXOnLoadResult = {
              contents: processedContent,
              loader: 'mdx' as MDXLoader,
              watchFiles: [args.path]
            }
            virtualFs.set(virtualPath, virtualFile)

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
        } catch (error) {
          console.error('File read error:', error)
          return {
            errors: [{ text: 'Failed to read file' }],
            loader: 'mdx' as MDXLoader
          }
        }
      })

      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
        const virtualFile = virtualFs.get(args.path)
        if (!virtualFile) {
          return {
            errors: [{ text: `Virtual file not found: ${args.path}` }],
            loader: 'mdx' as MDXLoader
          }
        }
        return virtualFile
      })

      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args: LoadArgs): Promise<MDXOnLoadResult> => {
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
          const virtualFile: MDXOnLoadResult = {
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
