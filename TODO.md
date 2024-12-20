# Implementation Plan

## Core Plugin Implementation

- [x] Set up plugin structure extending @mdx-js/esbuild
- [x] Integrate mdxld for YAML-LD parsing
- [x] Add remark-mdxld for MDX enrichment
- [x] Implement URI/HTTP import resolution
  - [x] Add onResolve hook for http(s):// imports
  - [x] Add onLoad hook to fetch remote content
  - [x] Cache remote content for performance
  - [x] Handle error cases and timeouts

## Current Blockers
- [ ] Need unified package for proper type definitions
- [ ] Resolve type errors in MDXLDOptions interface

## WASM Support

- [ ] Create separate entry point for WASM
- [ ] Implement WASM-specific plugin wrapper
- [ ] Add WASM build configuration
- [ ] Test WASM functionality

## Documentation

- [x] Add initial README
- [ ] Add API documentation
- [x] Add examples for common use cases
- [x] Document configuration options
- [x] Add contributing guidelines

## Testing

- [x] Unit tests for core functionality
- [x] Integration tests with example MDX files
- [ ] WASM-specific tests
- [x] Remote content import tests

## Future Enhancements

- [ ] Add support for custom remote content resolvers
- [ ] Implement caching strategies for remote content
- [ ] Add validation for remote content schemas
- [ ] Support for custom YAML-LD contexts
