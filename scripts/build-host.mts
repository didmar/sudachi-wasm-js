import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const CACHE_DIR = join(ROOT_DIR, '.cache')
const DEFAULT_UPSTREAM_DIR = join(CACHE_DIR, 'upstream', 'sudachi-wasm')
const UPSTREAM_DIR = process.env.SUDACHI_WASM_UPSTREAM_DIR ?? DEFAULT_UPSTREAM_DIR
const UPSTREAM_REF = 'e26175377378f20d8e4449f9ff0ab87a0b94e78d'
const RUNTIME_PACKAGE_DIR = join(ROOT_DIR, 'packages', 'sudachi-wasm')
const CONVERTER_PACKAGE_DIR = join(ROOT_DIR, 'packages', 'sudachi-dic-converter-linux-x64')
const RUNTIME_DIST_DIR = join(RUNTIME_PACKAGE_DIR, 'dist')
const CONVERTER_BIN_DIR = join(CONVERTER_PACKAGE_DIR, 'bin')

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
}

function ensureUpstreamCheckout(): void {
  if (!existsSync(UPSTREAM_DIR)) {
    mkdirSync(join(UPSTREAM_DIR, '..'), { recursive: true })
    run('git', ['clone', 'https://github.com/f3liz-dev/sudachi-wasm', UPSTREAM_DIR], ROOT_DIR)
  }

  run('git', ['fetch', '--tags', '--force', 'origin'], UPSTREAM_DIR)
  run('git', ['checkout', UPSTREAM_REF], UPSTREAM_DIR)
  run('git', ['submodule', 'update', '--init', '--recursive'], UPSTREAM_DIR)
}

function emptyDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true })
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { force: true, recursive: true })
  }
}

function copyRequiredFile(source: string, destination: string): void {
  if (!existsSync(source)) {
    throw new Error(`Missing expected build artifact: ${source}`)
  }

  copyFileSync(source, destination)
}

function buildRuntime(): void {
  run('wasm-pack', ['build', '--target', 'nodejs', '--release'], UPSTREAM_DIR)

  emptyDirectory(RUNTIME_DIST_DIR)

  const pkgDir = join(UPSTREAM_DIR, 'pkg')
  copyRequiredFile(join(pkgDir, 'sudachi_wasm.js'), join(RUNTIME_DIST_DIR, 'sudachi_wasm.js'))
  copyRequiredFile(
    join(pkgDir, 'sudachi_wasm_bg.wasm'),
    join(RUNTIME_DIST_DIR, 'sudachi_wasm_bg.wasm'),
  )
  copyRequiredFile(join(pkgDir, 'sudachi_wasm.d.ts'), join(RUNTIME_DIST_DIR, 'sudachi_wasm.d.ts'))

  const wasmTypesPath = join(pkgDir, 'sudachi_wasm_bg.wasm.d.ts')
  if (existsSync(wasmTypesPath)) {
    copyRequiredFile(wasmTypesPath, join(RUNTIME_DIST_DIR, 'sudachi_wasm_bg.wasm.d.ts'))
  }

  copyRequiredFile(join(pkgDir, 'package.json'), join(RUNTIME_DIST_DIR, 'package.json'))
}

function buildConverter(): void {
  run('cargo', ['build', '--release', '--bin', 'dic_converter'], UPSTREAM_DIR)

  emptyDirectory(CONVERTER_BIN_DIR)
  copyRequiredFile(
    join(UPSTREAM_DIR, 'target', 'release', 'dic_converter'),
    join(CONVERTER_BIN_DIR, 'dic_converter'),
  )
}

function ensureHostPlatform(): void {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error(
      `This workspace currently packages the host artifacts for linux-x64 only. Current host: ${process.platform}-${process.arch}`,
    )
  }
}

ensureHostPlatform()
ensureUpstreamCheckout()
buildRuntime()
buildConverter()

// Keep package directories non-empty for npm publish and local file installs.
for (const dir of [RUNTIME_DIST_DIR, CONVERTER_BIN_DIR]) {
  if (!existsSync(dir) || readdirSync(dir).length === 0) {
    throw new Error(`Build output missing from ${dir}`)
  }

  if (!statSync(dir).isDirectory()) {
    throw new Error(`Expected directory at ${dir}`)
  }
}

cpSync(join(ROOT_DIR, 'README.md'), join(RUNTIME_PACKAGE_DIR, 'README.md'))
cpSync(join(ROOT_DIR, 'README.md'), join(CONVERTER_PACKAGE_DIR, 'README.md'))
