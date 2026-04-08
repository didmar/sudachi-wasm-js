# `sudachi-wasm-js`

This repository packages the build outputs of the Rust project
[`sudachi-wasm`](https://github.com/f3liz-dev/sudachi-wasm) as reusable npm packages.

The upstream Rust repo contains the actual implementation:

- the WebAssembly bindings for Sudachi
- the generated Node.js glue code produced by `wasm-pack`
- the native `dic_converter` binary used to convert Sudachi dictionaries to MARISA format

This repo is only the packaging layer. Its purpose is to take artifacts built from the upstream
Rust source and publish them in forms that JavaScript and TypeScript consumers can install without
having to clone the Rust repo or build Rust code locally.

## Packages

Current packages in this workspace:

- `@didmar/sudachi-wasm`
- `@didmar/sudachi-dic-converter-linux-x64`

These are artifact-only packages. Consumer installs should not compile Rust.

## How It Works

`pnpm build:host` does the following:

1. clones or reuses a checkout of the upstream `sudachi-wasm` repository
2. checks out the pinned upstream commit
3. initializes the upstream submodules
4. builds the Node.js WASM package with `wasm-pack`
5. builds the host `dic_converter` binary with Cargo
6. copies the resulting artifacts into `packages/`

By default, the upstream checkout is stored in:

```bash
.cache/upstream/sudachi-wasm
```

To reuse an existing local checkout of the Rust repo instead, set:

```bash
SUDACHI_WASM_UPSTREAM_DIR=/path/to/sudachi-wasm
```

## Build Locally

Prerequisites:

- Rust toolchain
- `wasm32-unknown-unknown` target
- `wasm-pack`
- pnpm

Then run:

```bash
pnpm install
pnpm build:host
```

At the moment, `build:host` is implemented for the current host platform and this workspace
currently includes the Linux x64 converter package.

## Package Contents

### `@didmar/sudachi-wasm`

Built from the upstream `wasm-pack build --target nodejs` output.

Contents:

- `dist/sudachi_wasm.js`
- `dist/sudachi_wasm_bg.wasm`
- `dist/sudachi_wasm.d.ts`
- `dist/sudachi_wasm_bg.wasm.d.ts`
- `dist/package.json`

### `@didmar/sudachi-dic-converter-linux-x64`

Built from the upstream Cargo binary target `dic_converter`.

Contents:

- `bin/dic_converter`

## Publish

After building, publish from each package directory:

```bash
pnpm --dir packages/sudachi-wasm publish --access public
pnpm --dir packages/sudachi-dic-converter-linux-x64 publish --access public
```

Because these are scoped packages, the first publish must use `--access public`.

## GitHub Actions

The repository includes a `build.yml` workflow that rebuilds the Linux x64 packages on push and on
manual dispatch. This is intended to verify that the packaging layer still reproduces the expected
artifacts from the pinned upstream Rust source.
