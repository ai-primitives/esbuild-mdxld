import type { Plugin, OnLoadResult, Loader } from 'esbuild'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import { parse } from 'yaml'
import fs from 'node:fs/promises'
import https from 'node:https'
import http from 'node:http'
import { Buffer } from 'node:buffer'

const httpCache = new Map<string, { content: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

export interface MDXLDOptions {
  jsxImportSource?: string
  validateRequired?: boolean
  preferDollarPrefix?: boolean
  httpCacheTTL?: number
  httpTimeout?: number
}

const fetchWithTimeout = (url: string, timeout: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      const chunks: Uint8Array[] = []
      response.on('data', (chunk: Uint8Array) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })

    request.setTimeout(timeout, () => {
      request.destroy()
      reject(new Error('Request timeout'))
    })

    request.on('error', reject)
  })
}

export const mdxld = (options: MDXLDOptions = {}): Plugin => {
  const mdxPlugin = mdx({
    ...options,
    remarkPlugins: [
      [
        remarkMdxld,
        {
          validateRequired: options.validateRequired,
          preferDollarPrefix: options.preferDollarPrefix,
        },
      ],
    ],
  })

  return {
    name: 'mdxld',
    setup(build) {
      mdxPlugin.setup(build)

      build.onLoad({ filter: /\.mdx?$/ }, async (args): Promise<OnLoadResult> => {
        try {
          const source = await fs.readFile(args.path, 'utf8')
          const match = source.match(/^---\n([\s\S]*?)\n---/)

          if (match) {
            const frontmatter = match[1]
            const yamlData = parse(frontmatter)

            const processedYaml = Object.entries(yamlData).reduce(
              (acc, [key, value]) => {
                if (key.startsWith('@') || (options.preferDollarPrefix && key.startsWith('$'))) {
                  const cleanKey = key.slice(1)
                  acc[cleanKey] = value
                } else {
                  acc[key] = value
                }
                return acc
              },
              {} as Record<string, unknown>,
            )

            const processedSource = source.replace(/^---\n[\s\S]*?\n---/, `---\n${JSON.stringify(processedYaml, null, 2)}\n---`)

            return {
              contents: processedSource,
              loader: 'mdx' as Loader,
            }
          }

          return {
            contents: source,
            loader: 'mdx' as Loader,
          }
        } catch (error: unknown) {
          const err = error as Error
          return {
            errors: [
              {
                text: `Error processing MDX file: ${err.message}`,
                location: { file: args.path },
              },
            ],
          }
        }
      })

      build.onResolve({ filter: /^https?:\/\// }, (args) => {
        return { path: args.path, namespace: 'http-import' }
      })

      build.onLoad({ filter: /.*/, namespace: 'http-import' }, async (args): Promise<OnLoadResult> => {
        const cacheTTL = options.httpCacheTTL ?? CACHE_TTL
        const timeout = options.httpTimeout ?? 10000

        try {
          const cached = httpCache.get(args.path)
          if (cached && Date.now() - cached.timestamp < cacheTTL) {
            return {
              contents: cached.content,
              loader: 'mdx' as Loader,
            }
          }

          const content = await fetchWithTimeout(args.path, timeout)

          httpCache.set(args.path, {
            content,
            timestamp: Date.now(),
          })

          return {
            contents: content,
            loader: 'mdx' as Loader,
          }
        } catch (error: unknown) {
          const err = error as Error
          return {
            errors: [
              {
                text: `Error fetching remote content: ${err.message}`,
                location: { file: args.path },
              },
            ],
          }
        }
      })
    },
  }
}

export default mdxld
