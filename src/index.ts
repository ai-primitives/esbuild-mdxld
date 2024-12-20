import type { Plugin } from 'esbuild'
import mdx from '@mdx-js/esbuild'
import remarkMdxld from 'remark-mdxld'
import { parse } from 'yaml'

export interface MDXLDOptions {
  jsxImportSource?: string
  validateRequired?: boolean
  preferDollarPrefix?: boolean
}

export const mdxld = (options: MDXLDOptions = {}): Plugin => {
  const mdxPlugin = mdx({
    ...options,
    remarkPlugins: [
      [remarkMdxld, {
        validateRequired: options.validateRequired,
        preferDollarPrefix: options.preferDollarPrefix
      }]
    ]
  })

  return {
    name: 'mdxld',
    setup(build) {
      mdxPlugin.setup(build)
    }
  }
}

export default mdxld
