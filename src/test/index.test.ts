import { describe, it, expect } from 'vitest'
import { mdxld } from '../index'

describe('mdxld plugin', () => {
  it('should create a plugin with default options', () => {
    const plugin = mdxld()
    expect(plugin.name).toBe('mdxld')
  })

  it('should pass options to remark-mdxld', () => {
    const plugin = mdxld({
      validateRequired: true,
      preferDollarPrefix: true
    })
    expect(plugin.name).toBe('mdxld')
  })
})
