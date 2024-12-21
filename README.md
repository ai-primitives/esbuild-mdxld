# esbuild-mdxld

[![npm version](https://badge.fury.io/js/esbuild-mdxld.svg)](https://www.npmjs.com/package/esbuild-mdxld)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ESBuild plugin for MDX with Linked Data Context and URI/HTTP imports. Extends @mdx-js/esbuild with YAML-LD support and remote content imports.

## Requirements

- Node.js 18 or higher (for native fetch API support)

## Features

- 🔗 Full YAML-LD support in frontmatter
  - Supports both @ and $ prefixes ($ preferred)
  - Handles all value types (strings, numbers, objects, arrays)
  - Automatic prefix normalization
- 📡 URI/HTTP imports with native fetch and caching
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

## Dependencies

- [@mdx-js/esbuild](https://www.npmjs.com/package/@mdx-js/esbuild): MDX support for esbuild
- [gray-matter](https://www.npmjs.com/package/gray-matter): Frontmatter parsing
- [js-yaml](https://www.npmjs.com/package/js-yaml): YAML parsing
- [mdxld](https://www.npmjs.com/package/mdxld): YAML-LD processing
- [remark-mdxld](https://www.npmjs.com/package/remark-mdxld): MDX enrichment
