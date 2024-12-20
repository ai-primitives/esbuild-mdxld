import type { Loader } from 'esbuild'

export type MDXLoader = Extract<Loader, 'mdx' | 'js'>

export interface VirtualFile {
  contents: string
  loader: MDXLoader
}

export type LoadArgs = { path: string; namespace: string }
