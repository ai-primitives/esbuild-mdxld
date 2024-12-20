import { Plugin, OnLoadArgs, OnLoadResult, Loader, OnLoadOptions } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import https from 'node:https'
import { Buffer } from 'node:buffer'
import type { Pluggable } from 'unified'

const httpCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Virtual file system for processed content
const virtualFs = new Map<string, string>()

export interface MDXLDOptions {
  jsxImportSource?: string
  validateRequired?: boolean
  preferDollarPrefix?: boolean
  httpCacheTTL?: number
  httpTimeout?: number
  remarkPlugins?: Pluggable[]
}

const fetchWithTimeout = (url: string, timeout: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode === 404) {
        reject(new Error('HTTP 404: Not Found'))
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      response.on('error', (error) => reject(error))
    })

    request.setTimeout(timeout, () => {
      request.destroy()
      reject(new Error(`Request timeout after ${timeout}ms`))
    })

    request.on('error', (error) => reject(error))
  })
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
    // Handle @ and $ prefixes, preserving the original prefix
    if (key.startsWith('@') || key.startsWith('$')) {
      result[key] = processValue(value)
    } else {
      // Add prefix to known JSON-LD keys
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
      // Store the MDX plugin's onLoad callback
      let mdxOnLoad: ((args: OnLoadArgs) => Promise<OnLoadResult>) | undefined

      // Set up MDX plugin first and capture its onLoad callback
      mdxPlugin.setup({
        ...build,
        onLoad: (options: OnLoadOptions, callback: (args: OnLoadArgs) => Promise<OnLoadResult | null | undefined>) => {
          if (options.filter.toString() === '/\\.mdx?$/') {
            mdxOnLoad = async (args) => {
              const result = await callback(args)
              return result ?? { contents: '', loader: 'mdx' as Loader }
            }
          }
          return build.onLoad(options, callback)
        },
      })

      // Handle virtual file system
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, async (args) => {
        const contents = virtualFs.get(args.path)
        if (!contents) {
          return {
            errors: [
              {
                text: `Virtual file not found: ${args.path}`,
                location: { file: args.path },
              },
            ],
          }
        }

        // Pass through MDX plugin if available and path ends with .mdx
        if (mdxOnLoad && args.path.endsWith('.mdx')) {
          const result = await mdxOnLoad(args)
          return result ?? { contents, loader: 'mdx' as Loader }
        }

        return { contents, loader: 'mdx' as Loader }
      })

      // Handle HTTP imports resolution
      build.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        namespace: 'http-import',
      }))

      // Handle HTTP imports loading
      build.onLoad({ filter: /.*/, namespace: 'http-import' }, async (args): Promise<OnLoadResult> => {
        const cacheTTL = options.httpCacheTTL ?? CACHE_TTL
        const timeout = options.httpTimeout ?? 10000

        try {
          const cached = httpCache.get(args.path)
          if (cached && Date.now() - cached.timestamp < cacheTTL) {
            virtualFs.set(args.path, cached.content)
            return { contents: cached.content, loader: 'mdx' as Loader }
          }

          const content = await fetchWithTimeout(args.path, timeout)
          httpCache.set(args.path, {
            content,
            timestamp: Date.now(),
          })

          virtualFs.set(args.path, content)
          return { contents: content, loader: 'mdx' as Loader }
        } catch {
          return {
            errors: [
              {
                text: 'HTTP 404: Not Found',
                location: { file: args.path },
              },
            ],
            loader: 'mdx' as Loader,
          }
        }
      })

      // Handle local MDX files
      build.onLoad({ filter: /\.mdx?$/, namespace: 'file' }, async (args): Promise<OnLoadResult> => {
        try {
          const source = await readFile(args.path, 'utf8')
          const match = source.match(/^---\n([\s\S]*?)\n---/)

          if (!match) {
            // No frontmatter, pass through to MDX plugin
            virtualFs.set(args.path, source)
            if (mdxOnLoad) {
              return mdxOnLoad({ ...args, path: args.path })
            }
            return { contents: source, loader: 'mdx' as Loader }
          }

          const frontmatter = match[1].trim()
          if (!frontmatter) {
            // Empty frontmatter, pass through to MDX plugin
            virtualFs.set(args.path, source)
            if (mdxOnLoad) {
              return mdxOnLoad({ ...args, path: args.path })
            }
            return { contents: source, loader: 'mdx' as Loader }
          }

          try {
            const yamlData = parse(frontmatter)
            if (typeof yamlData !== 'object' || yamlData === null) {
              throw new Error('Invalid YAML: expected an object')
            }

            const processedYaml = processYamlLd(yamlData as Record<string, unknown>, Boolean(options.preferDollarPrefix))
            const yamlString = JSON.stringify(processedYaml, null, 2)
            const contentAfterFrontmatter = source.slice(match[0].length).trim()

            // Create the processed MDX content with the YAML-LD data in frontmatter
            const processedContent = `---\n${yamlString}\n---\n\n${contentAfterFrontmatter}`

            virtualFs.set(args.path, processedContent)
            if (mdxOnLoad) {
              return mdxOnLoad({ ...args, path: args.path })
            }
            return { contents: processedContent, loader: 'mdx' as Loader }
          } catch {
            return {
              errors: [
                {
                  text: 'Invalid YAML syntax',
                  location: { file: args.path, lineText: frontmatter },
                },
              ],
              loader: 'mdx' as Loader,
            }
          }
        } catch (error) {
          const err = error as Error
          return {
            errors: [
              {
                text: `Cannot process MDX file: ${err.message}`,
                location: { file: args.path },
              },
            ],
            loader: 'mdx' as Loader,
          }
        }
      })
    },
  }
}
