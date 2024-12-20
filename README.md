# esbuild-mdxld

ESBuild plugin for MDX with Linked Data Context and URI/HTTP imports. Extends @mdx-js/esbuild with YAML-LD support and remote content imports.

## Features

- 🔗 Full YAML-LD support in frontmatter
- 📡 URI/HTTP imports for remote content
- 🌐 WASM support via esbuild-mdxld/wasm
- 🔄 Integrated with remark-mdxld for enrichment
- 📦 Type-safe parsing and validation

## Installation

```bash
npm install esbuild-mdxld
# or
pnpm add esbuild-mdxld
```

## Usage

```typescript
import mdxld from 'esbuild-mdxld'
import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['index.mdx'],
  outfile: 'out.js',
  plugins: [
    mdxld({
      // Options from @mdx-js/esbuild
      jsxImportSource: '@mdx-js/react',
      // Additional mdxld options
      validateRequired: true,
      preferDollarPrefix: true,
    }),
  ],
})
```

## WASM Usage

```typescript
import mdxld from 'esbuild-mdxld/wasm'
// ... same usage as above
```
