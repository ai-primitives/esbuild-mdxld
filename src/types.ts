import type { OnLoadArgs, OnLoadResult, Plugin, Loader, OnResolveArgs, OnResolveResult } from 'esbuild'
import type { Pluggable } from 'unified'

export type MDXLoader = Extract<Loader, 'mdx'>

export interface VirtualFile extends Omit<OnLoadResult, 'contents'> {
  contents: string | Record<string, unknown>
  loader: MDXLoader
  watchFiles?: string[]
  path?: string
  namespace?: string
  errors?: { text: string }[]
}

export interface LoadArgs extends OnLoadArgs {
  path: string
}

export interface ResolveArgs extends OnResolveArgs {
  path: string
}

export interface MDXOnLoadResult extends OnLoadResult {
  contents?: string
  loader?: MDXLoader
  watchFiles?: string[]
  path?: string
  namespace?: string
  errors?: { text: string }[]
}

export interface MDXLDOptions {
  preferDollarPrefix?: boolean
  remarkPlugins?: Pluggable[]
  rehypePlugins?: Pluggable[]
}

export type { Plugin, OnResolveResult }
