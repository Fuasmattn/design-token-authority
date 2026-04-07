# Changelog

## 1.0.0 (2026-04-07)

### Features

* **002:** upgrade Style Dictionary v3 → v4, eliminate $ stripping hack ([89a638f](https://github.com/Fuasmattn/design-token-authority/commit/89a638f8c2c6002df447371501cbc69da935058f))
* **007,008:** add project config schema and CLI framework ([f5777de](https://github.com/Fuasmattn/design-token-authority/commit/f5777de4f9c9e8f2cb65fe66fa1e3cb3e01eddbc))
* **009,010:** add Tailwind v3 and v4 output formatters ([799fcc4](https://github.com/Fuasmattn/design-token-authority/commit/799fcc4e2c33658646cddb42ad99e6677b5849ae))
* **014,015:** add Figma autodiscovery analyzer and init wizard ([8ee6d30](https://github.com/Fuasmattn/design-token-authority/commit/8ee6d3089e301b19c758e1bc4759249e8084b35a))
* **026:** per-brand build output and Tailwind theme integration ([5fb651e](https://github.com/Fuasmattn/design-token-authority/commit/5fb651e3b3391ba9507d3e982199afbeb0befa72))
* **027:** rename to design-token-farm and rewrite README ([561449e](https://github.com/Fuasmattn/design-token-authority/commit/561449ee812b6b457d5e425cd99ac700118b059f))
* adapt configs; fix ts errors ([62c7358](https://github.com/Fuasmattn/design-token-authority/commit/62c7358b4b5846fcbd3eee354714a727972dee58))
* add .gitconfig to .gitignore ([d5a3ce6](https://github.com/Fuasmattn/design-token-authority/commit/d5a3ce639aa68c9b4f542c84f1fbc7c4bf133d58))
* add `dtf graph` command for token dependency analysis (TICKET-017) ([87388a1](https://github.com/Fuasmattn/design-token-authority/commit/87388a15325319c7d96984a65a8ecf1af67ec973))
* add confirmation prompt for `dta push` command and support for skipping confirmation ([f35407b](https://github.com/Fuasmattn/design-token-authority/commit/f35407b083a39fb1e15ac177f1991e1c71e31cb7))
* add dependabot configuration for weekly npm updates ([831f1dd](https://github.com/Fuasmattn/design-token-authority/commit/831f1dd36e61678c14a434f07aa07bed88f574c7))
* add diff output format option to `dtf push` command and implement structured diff report ([c62936e](https://github.com/Fuasmattn/design-token-authority/commit/c62936e8ad8dceb59ea5cf3c8fef8416e2b65572))
* add dtf clean command and rename default output folder to output ([01461a2](https://github.com/Fuasmattn/design-token-authority/commit/01461a21d448b60d8eac321f1a63374766878a8e))
* add dtf.config.ts and update build scripts in package.json ([e1cf610](https://github.com/Fuasmattn/design-token-authority/commit/e1cf610315e2195592de55741e2148c9671deca7))
* add MIT license and update package metadata with additional keywords ([38bd7a6](https://github.com/Fuasmattn/design-token-authority/commit/38bd7a6c44420f108c042d8baaf61c68776cab5e))
* add Node.js version requirement and update Bash permissions in settings ([676721c](https://github.com/Fuasmattn/design-token-authority/commit/676721cc08ed4c393e17b4687ea97a6ede128f54))
* add token dependency graph command and documentation ([35e481d](https://github.com/Fuasmattn/design-token-authority/commit/35e481d200984e99a4e8af9ab7bc1bd57469a501))
* add token documentation HTML page to build output ([0a5da98](https://github.com/Fuasmattn/design-token-authority/commit/0a5da9864133597198e681dfab97a89f47f1a44f))
* enhance CLI functionality with validation and user confirmation for push command ([46a0c86](https://github.com/Fuasmattn/design-token-authority/commit/46a0c861f3eb6dcd49620c4c1a5fe8512a12e4d7))
* enhance graph HTML visualization with semantic zoom, auto-fit, and color tokens ([cf2b89e](https://github.com/Fuasmattn/design-token-authority/commit/cf2b89e08cef5c4d1bfb4c7f1ae9afbd9e8b83d1))
* enhance token documentation HTML with brand dropdown and toast notifications ([66b0bb4](https://github.com/Fuasmattn/design-token-authority/commit/66b0bb46e28fecf3aa7d1280d2cdce7956bc541a))
* enhance token documentation with spacing and effects sections, including alias chain display ([d55b65a](https://github.com/Fuasmattn/design-token-authority/commit/d55b65ad36b5a50b91fd6c4a8626bd9a05a2434e))
* integrate @clack/prompts for improved CLI experience and update commands for better user interaction ([f70cc50](https://github.com/Fuasmattn/design-token-authority/commit/f70cc50343364441c6907229b859c1b69095cf55))
* **lint:** implement token linting with built-in and configurable rules ([f75a73c](https://github.com/Fuasmattn/design-token-authority/commit/f75a73cc911d98086e8b1d9a0fe4fb97326043a9))
* redesign graph visualization with Apple Liquid Glass UI ([0a213f8](https://github.com/Fuasmattn/design-token-authority/commit/0a213f8730cdfbc6cc5b08b6b652be1e8bfab91f))
* remove outdated Figma sync workflows and add comprehensive build tests ([3eb2719](https://github.com/Fuasmattn/design-token-authority/commit/3eb2719a2c1a1cbb122a0ed07de4669244c2bcb2))
* rename project from Design Token Farm (dtf) to Design Token Authority (dta) ([74be4c5](https://github.com/Fuasmattn/design-token-authority/commit/74be4c50d02f4922f980ae0a3e0bafdf47d5c6a9))
* support non-Enterprise Figma plans with file-based token import ([905f4b7](https://github.com/Fuasmattn/design-token-authority/commit/905f4b72d9f0f67a5f2a09521ca87a99f8b60810))

### Bug Fixes

* **001,005:** secure credentials handling and standardize env variable names ([3ce55a9](https://github.com/Fuasmattn/design-token-authority/commit/3ce55a996f312848617c9bb05da03cb3b5b0fba8))
* **003,004:** fix CSS variable units and deduplicate repeated name segments ([91d5f3e](https://github.com/Fuasmattn/design-token-authority/commit/91d5f3ec4fc3af57b7d9ae9d190fac3d3cf9a4a3))
* **003:** extend dimension-px transform to spacing, sizes, and corner-radius ([0e5fdf7](https://github.com/Fuasmattn/design-token-authority/commit/0e5fdf7a71f92fd6da21ba49100310982c8f8cd9))
* **004:** sanitize all non-identifier chars in CSS variable names ([dc6fa3b](https://github.com/Fuasmattn/design-token-authority/commit/dc6fa3bb543741018ba4c624da527c2e9f8c962a))
* handle null values in compareVariableValues function ([5168aae](https://github.com/Fuasmattn/design-token-authority/commit/5168aae39ded102d30907f4649ad9a9d1411db72))
* improve docs HTML color grouping and click-to-copy feedback ([d783c35](https://github.com/Fuasmattn/design-token-authority/commit/d783c35ee87c013d05965d97dcd4aeb121500d39))
* repair CLI build pipeline for npx dtf usage ([3ea2629](https://github.com/Fuasmattn/design-token-authority/commit/3ea262929d15d237fe4021828c0bb1abd797ca27))
* resolve npm audit vulnerabilities in dependencies ([be4c1cb](https://github.com/Fuasmattn/design-token-authority/commit/be4c1cbf4c1ff3dd86e91725d06b631fe8983347))
* set default zoom level so token names are readable on load ([a90cd7c](https://github.com/Fuasmattn/design-token-authority/commit/a90cd7c1f949d6d9ce42f4828258e52be7c2a6b3))
* tsconfig ([c9660e5](https://github.com/Fuasmattn/design-token-authority/commit/c9660e5db4237d7310e10c6840cb6c1b73ea5a28))
* update @types/node version and adjust TypeScript target to es2022 ([ed09e82](https://github.com/Fuasmattn/design-token-authority/commit/ed09e828dcbe799e8fbf3bc3a3c8af9628b26640))
* update copyright holder in LICENSE and remove obsolete LICENSE.md ([9519c4b](https://github.com/Fuasmattn/design-token-authority/commit/9519c4bfdf803388ce3c4e911f874ab0788f27f4))
* wrap StyleDictionary build in async function to resolve TS diagnostic ([469a997](https://github.com/Fuasmattn/design-token-authority/commit/469a99715b9f76f9f3e1da04d2f6524b10185c3d))

### Refactoring

* rename CLI from figma-tokens to design-token-farm (alias: dtf) ([1fe3dac](https://github.com/Fuasmattn/design-token-authority/commit/1fe3dace57cce390d8935e38598d46e2d78c58e2))

### Documentation

* **026:** add data-brand attribute as recommended Pattern A ([dc802f2](https://github.com/Fuasmattn/design-token-authority/commit/dc802f2fdffe32061ac4f21e5f56e12abcee5b4c))
* **026:** per-brand build output and Tailwind theme integration ticket ([5d3dc78](https://github.com/Fuasmattn/design-token-authority/commit/5d3dc7869f39d5a5b3b708d23b8441c3e0cdf8df))
* **027:** rename project and replace README ticket ([47e4fdb](https://github.com/Fuasmattn/design-token-authority/commit/47e4fdbc9fb1c5de7a93d42b4d42537bae4c04ec))
* add project CLAUDE.md, feature tickets, and improvement roadmap ([ff17ccb](https://github.com/Fuasmattn/design-token-authority/commit/ff17ccb2193a78ea553611ddab1b24563c5a165f))
* add TICKET-025 — switch from Jest to Vitest ([e0215f2](https://github.com/Fuasmattn/design-token-authority/commit/e0215f2bd0e30a38b18e482df243a835fa283363))
* mark tickets 001, 002, 005, 025 as done with ticked checkboxes ([cf6b332](https://github.com/Fuasmattn/design-token-authority/commit/cf6b33217d0e620dde7e9bbf09f1b6aa03be4e67))
* mark tickets 003 and 004 as done ([c0b1d0c](https://github.com/Fuasmattn/design-token-authority/commit/c0b1d0c4e8d19be536c2c8a21e1187d3c2053786))
* update README with CLI commands and config reference ([e6d80c8](https://github.com/Fuasmattn/design-token-authority/commit/e6d80c806ffbf1c75223e9a151f11ba77e4e3584))
