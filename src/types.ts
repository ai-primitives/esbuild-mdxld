import type { OnLoadArgs, OnLoadResult, Plugin, Loader, OnResolveArgs, OnResolveResult } from 'esbuild'
import type { Pluggable } from 'unified'

export type MDXLoader = Extract<Loader, 'mdx'>

export interface VirtualFile {
  contents: string
  loader: MDXLoader
  watchFiles?: string[]
}

export interface LoadArgs extends OnLoadArgs {
  path: string
}

export interface ResolveArgs extends OnResolveArgs {
  path: string
}

export interface MDXOnLoadResult extends OnLoadResult {
  path?: string
  namespace?: string
  loader?: MDXLoader
}

export interface MDXLDOptions {
  preferDollarPrefix?: boolean
  remarkPlugins?: Pluggable[]
  rehypePlugins?: Pluggable[]
}

export type { Plugin, OnResolveResult }
