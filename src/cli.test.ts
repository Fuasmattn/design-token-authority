import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'

const CLI = 'npx tsx src/cli.ts'

function run(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, NODE_ENV: 'test' },
    })
    return { stdout, exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: (e.stdout ?? '') + (e.stderr ?? ''),
      exitCode: e.status ?? 1,
    }
  }
}

describe('CLI', () => {
  it('prints help with --help', () => {
    const result = run('--help')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Design Token Farm')
    expect(result.stdout).toContain('pull')
    expect(result.stdout).toContain('push')
    expect(result.stdout).toContain('build')
    expect(result.stdout).toContain('init')
  })

  it('prints help for pull subcommand', () => {
    const result = run('pull --help')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--output')
    expect(result.stdout).toContain('--config')
    expect(result.stdout).toContain('--verbose')
  })

  it('prints help for push subcommand', () => {
    const result = run('push --help')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--config')
  })

  it('prints help for build subcommand', () => {
    const result = run('build --help')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--config')
  })

  it('prints help for init subcommand', () => {
    const result = run('init --help')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--verbose')
  })

  it('prints version with --version', () => {
    const result = run('--version')
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('exits with error when pull is run without config', () => {
    // Use a non-existent config path to force error
    const result = run('pull --config /tmp/nonexistent-config-file.ts')
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toContain('Config file not found')
  })
})
