import { describe, it, expect } from 'vitest'
import { convertTokenHausExport } from './tokenhaus.js'

describe('convertTokenHausExport', () => {
  it('splits multi-mode tokens into separate files', () => {
    const data = {
      $name: 'Test File',
      $extensions: {
        'com.figma': { modes: { 'col:1': ['m:1', 'm:2'] } },
      },
      Theme: {
        color: {
          primary: {
            $type: 'color',
            $value: { Light: '#ffffff', Dark: '#000000' },
            $extensions: { 'com.figma': { scopes: ['ALL_SCOPES'] } },
          },
        },
      },
    }

    const result = convertTokenHausExport(data)

    expect(Object.keys(result)).toHaveLength(2)
    expect(result['Theme.Light.json']).toBeDefined()
    expect(result['Theme.Dark.json']).toBeDefined()

    const light = result['Theme.Light.json'] as any
    expect(light.color.primary.$type).toBe('color')
    expect(light.color.primary.$value).toBe('#ffffff')

    const dark = result['Theme.Dark.json'] as any
    expect(dark.color.primary.$type).toBe('color')
    expect(dark.color.primary.$value).toBe('#000000')
  })

  it('puts single-mode tokens in a Mode 1 file', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Spacing: {
        small: {
          $type: 'number',
          $value: 4,
        },
        large: {
          $type: 'number',
          $value: 32,
          $description: 'Large spacing',
        },
      },
    }

    const result = convertTokenHausExport(data)

    expect(Object.keys(result)).toEqual(['Spacing.Mode 1.json'])
    const file = result['Spacing.Mode 1.json'] as any
    expect(file.small.$value).toBe(4)
    expect(file.large.$value).toBe(32)
    expect(file.large.$description).toBe('Large spacing')
  })

  it('preserves $extensions on tokens', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Colors: {
        red: {
          $type: 'color',
          $value: '#ff0000',
          $extensions: { 'com.figma': { scopes: ['ALL_SCOPES'], hiddenFromPublishing: false } },
        },
      },
    }

    const result = convertTokenHausExport(data)
    const file = result['Colors.Mode 1.json'] as any
    expect(file.red.$extensions['com.figma'].scopes).toEqual(['ALL_SCOPES'])
  })

  it('skips root metadata keys ($name, $description, $extensions)', () => {
    const data = {
      $name: 'File Name',
      $description: 'Description',
      $extensions: { 'com.figma': { modes: {} } },
      Tokens: {
        value: { $type: 'number', $value: 42 },
      },
    }

    const result = convertTokenHausExport(data)
    const keys = Object.keys(result)
    expect(keys).toEqual(['Tokens.Mode 1.json'])
  })

  it('handles deeply nested token groups', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Design: {
        typography: {
          heading: {
            size: {
              $type: 'number',
              $value: 24,
            },
          },
        },
      },
    }

    const result = convertTokenHausExport(data)
    const file = result['Design.Mode 1.json'] as any
    expect(file.typography.heading.size.$value).toBe(24)
  })

  it('handles mixed single-mode and multi-mode tokens in same collection', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Mixed: {
        spacing: {
          $type: 'number',
          $value: 8,
        },
        color: {
          $type: 'color',
          $value: { Light: '#fff', Dark: '#000' },
        },
      },
    }

    const result = convertTokenHausExport(data)
    expect(Object.keys(result).sort()).toEqual([
      'Mixed.Dark.json',
      'Mixed.Light.json',
      'Mixed.Mode 1.json',
    ])
    expect((result['Mixed.Mode 1.json'] as any).spacing.$value).toBe(8)
    expect((result['Mixed.Light.json'] as any).color.$value).toBe('#fff')
  })

  it('handles aliases in $value', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Semantic: {
        primary: {
          $type: 'color',
          $value: { Light: '{Colors.blue.500}', Dark: '{Colors.blue.300}' },
        },
      },
    }

    const result = convertTokenHausExport(data)
    expect((result['Semantic.Light.json'] as any).primary.$value).toBe('{Colors.blue.500}')
    expect((result['Semantic.Dark.json'] as any).primary.$value).toBe('{Colors.blue.300}')
  })

  it('handles boolean tokens', () => {
    const data = {
      $name: 'Test',
      $extensions: { 'com.figma': { modes: {} } },
      Flags: {
        enabled: {
          $type: 'boolean',
          $value: { On: true, Off: false },
        },
      },
    }

    const result = convertTokenHausExport(data)
    expect((result['Flags.On.json'] as any).enabled.$value).toBe(true)
    expect((result['Flags.Off.json'] as any).enabled.$value).toBe(false)
  })
})
