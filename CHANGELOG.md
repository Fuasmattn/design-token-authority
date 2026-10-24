# Changelog

## [2.0.5](https://github.com/Fuasmattn/design-token-authority/compare/v2.0.4...v2.0.5) (2026-10-24)

### Features

* **diff:** DTA mark in the pull-request comment (TICKET-144) ([ac8dfd8](https://github.com/Fuasmattn/design-token-authority/commit/ac8dfd84f63906d3e686c584aaf3912e1b39610c))

### Documentation

* **tickets:** close TICKET-086 and TICKET-087, add TICKET-143 ([4085a4b](https://github.com/Fuasmattn/design-token-authority/commit/4085a4bfda419886cf9d3eb3fd48adba874c3cfd)), closes [#28](https://github.com/Fuasmattn/design-token-authority/issues/28) [#29](https://github.com/Fuasmattn/design-token-authority/issues/29)
* **tickets:** close TICKET-140 and TICKET-141 ([059cb97](https://github.com/Fuasmattn/design-token-authority/commit/059cb97a49ac56ca4e5587a7f5cfcb34cab9cdca))
* **tickets:** close TICKET-143, add TICKET-144 (icon in the dta diff comment) ([73e36cd](https://github.com/Fuasmattn/design-token-authority/commit/73e36cd999d2236e9cdeebec4ee175029cd232ea))
* **tickets:** close TICKET-144 (checked on PR [#31](https://github.com/Fuasmattn/design-token-authority/issues/31)) ([2027866](https://github.com/Fuasmattn/design-token-authority/commit/2027866c3951274254f638d1f006915d18e6cb04))
* **tickets:** TICKET-141 released through OIDC, npm token removed ([75d96e3](https://github.com/Fuasmattn/design-token-authority/commit/75d96e34aafbe2b4c83db3aadff9d3a2df201f8b))
* **tickets:** TICKET-143 CI on main green, Dependabot PRs closed ([747f17e](https://github.com/Fuasmattn/design-token-authority/commit/747f17ec495794cae07db072f60924161b06a816))

## [2.0.4](https://github.com/Fuasmattn/design-token-authority/compare/v2.0.2...v2.0.4) (2026-10-24)

## [2.0.2](https://github.com/Fuasmattn/design-token-authority/compare/v2.0.1...v2.0.2) (2026-10-24)

### Features

* **site:** serve the website at dta.martinprinz.dev (TICKET-075 done) ([e21c575](https://github.com/Fuasmattn/design-token-authority/commit/e21c57501c3eea228f070f99e5eb2413a540ce84))

### Bug Fixes

* **security:** SECURITY.md, dependency audit, Node 24.22.1 (TICKET-140) ([9ebb0d2](https://github.com/Fuasmattn/design-token-authority/commit/9ebb0d2cdf9ab4249c68d862a3c62cadbad07432))

### Documentation

* install DTA from npm (TICKET-090 done) ([accbd4f](https://github.com/Fuasmattn/design-token-authority/commit/accbd4f5646d2fd7550a6696d5b3ce6154bc27ce))

## [2.0.1](https://github.com/Fuasmattn/design-token-authority/compare/v1.0.0...v2.0.1) (2026-10-24)

### ⚠ BREAKING CHANGES

* **cli:** remove @dta/docs and the generated token docs page (TICKET-067)

### Features

* agent guardrails for the overhaul (TICKET-038) ([c068577](https://github.com/Fuasmattn/design-token-authority/commit/c068577c4449526aa0d6ef6c38d74d755c58648d))
* build, lint, diff, queries and audit on the new types; resolver documents (TICKET-134, TICKET-136) ([a3fbf25](https://github.com/Fuasmattn/design-token-authority/commit/a3fbf253f8b433dac6e07827cf6304355573fb44))
* **build,lint:** nested brands (TICKET-093), contrast per mode (TICKET-092), breakpoint modes (TICKET-091) ([ee0a71e](https://github.com/Fuasmattn/design-token-authority/commit/ee0a71ed09d19e7e9f59ff79330fc70855a2d61c))
* **build:** native outputs for iOS Swift, Android XML and Compose (TICKET-011, 012, 013) ([c5894b3](https://github.com/Fuasmattn/design-token-authority/commit/c5894b393de3ba6926cbb0d1c2f66b602d255b4f))
* **build:** options, full parity test and package docs (TICKET-054) ([92f9be6](https://github.com/Fuasmattn/design-token-authority/commit/92f9be69da411f7426fb0af81e8ce28adbddb93f))
* **build:** package scaffold and base layer CSS (TICKET-049) ([8e53aac](https://github.com/Fuasmattn/design-token-authority/commit/8e53aac10ad1f22286ce324a78c5aca4a2d27926))
* **build:** per-brand CSS themes (TICKET-051) ([818fd90](https://github.com/Fuasmattn/design-token-authority/commit/818fd90d138a60d70c973b735ee6565498e69d96))
* **build:** shared CSS variables and JS palette (TICKET-050) ([cbf7d27](https://github.com/Fuasmattn/design-token-authority/commit/cbf7d27cbd70bf57d97c1cd71a199145904b6faf))
* **build:** Tailwind v3 output (TICKET-053) ([5d8f1b9](https://github.com/Fuasmattn/design-token-authority/commit/5d8f1b9b9f65c2a04b4785dc1e957eef4bbbae19))
* **build:** Tailwind v4 output (TICKET-052) ([5496ec0](https://github.com/Fuasmattn/design-token-authority/commit/5496ec0cc79c2d0b4fa5494c27febe7cc1fd6d2f))
* **cli:** detect the project for dta diff setup (TICKET-126) ([f45e8af](https://github.com/Fuasmattn/design-token-authority/commit/f45e8af20db79b9878575809c14a460417ede96a))
* **cli:** dta brief for AI design tools (TICKET-031) ([2548687](https://github.com/Fuasmattn/design-token-authority/commit/254868710b476c2ea81ee22711e86d9bebe86fc0))
* **cli:** init writes outputs.formats (TICKET-118); remove outputs.css.prefix (TICKET-117); close 123 ([587a356](https://github.com/Fuasmattn/design-token-authority/commit/587a35624274b4feaa3095612cc50334ebac7773))
* **cli:** new CLI skeleton, config loader and snapshot parity suite (TICKET-036) ([3b4b6a7](https://github.com/Fuasmattn/design-token-authority/commit/3b4b6a76a04f3edb01efe1042d4eec0ba2f3ff1f))
* **cli:** port analyze and clean; harness records Figma-backed scenarios (TICKET-064) ([d56aa66](https://github.com/Fuasmattn/design-token-authority/commit/d56aa66f5dd6a431f76f9c9313a1bd25ec6592b7))
* **cli:** port init wizard and cut over to the new CLI (TICKET-066) ([7a6270b](https://github.com/Fuasmattn/design-token-authority/commit/7a6270b6a6f08bb25f93a4d861e0b44f046fe053))
* **cli:** port pull and push; snapshots recorded from legacy, all green (TICKET-065) ([46e35c9](https://github.com/Fuasmattn/design-token-authority/commit/46e35c95770f3d3fe0521a27fa35da7ee5faf533))
* **cli:** port the build command, snapshot green (TICKET-062) ([2c47850](https://github.com/Fuasmattn/design-token-authority/commit/2c4785037b91bbfe0e9bfe8ea99b91b68c14c33a))
* **cli:** port the graph command (console, dot, markdown, html), snapshots green (TICKET-063) ([737d565](https://github.com/Fuasmattn/design-token-authority/commit/737d5655463f6376d791543a61e3b4c08f8857fa))
* **cli:** port the lint command, snapshot green (TICKET-060) ([cdbe203](https://github.com/Fuasmattn/design-token-authority/commit/cdbe203e692e964e8ee105f97ab4846ebfd493f9))
* **cli:** remove @dta/docs and the generated token docs page (TICKET-067) ([d8a55f3](https://github.com/Fuasmattn/design-token-authority/commit/d8a55f3997e0597bce55281d4da73d4fff186cb6))
* **cli:** shared I/O layer, UI helpers and lint schema in config (TICKET-059) ([91263dd](https://github.com/Fuasmattn/design-token-authority/commit/91263dd4aa86f3a5e95878882703ab9b4560e3a0))
* **core:** $ref, $root, $extends and aliases inside composite values (TICKET-133) ([d889f34](https://github.com/Fuasmattn/design-token-authority/commit/d889f34fd2d321515ad77146518e5af1bf45a032))
* **core:** all DTCG 2025.10 types and structured values (TICKET-132) ([5512f3a](https://github.com/Fuasmattn/design-token-authority/commit/5512f3a86240ee72923c9103bc7ea40099a8105e))
* **core:** color utilities (TICKET-041) ([50c68ae](https://github.com/Fuasmattn/design-token-authority/commit/50c68aead31d7742ca214e655f17a9048740680d))
* **core:** graph analysis with legacy-parity numbers (TICKET-043) ([2a9f2ae](https://github.com/Fuasmattn/design-token-authority/commit/2a9f2ae1a683e127c4e4ed87cd06771d06c891d9))
* **core:** name uniqueness and alias resolution with mode selection (TICKET-042) ([497d795](https://github.com/Fuasmattn/design-token-authority/commit/497d7950f6d7a1d4ac056d4b729622db2dc06b65))
* **core:** read .tokens and .tokens.json files (TICKET-135) ([0cd5815](https://github.com/Fuasmattn/design-token-authority/commit/0cd5815fcee48d33ac6380b2b56135c8e8216ad4))
* **core:** structure analysis on the token model (TICKET-048) ([86cd6b3](https://github.com/Fuasmattn/design-token-authority/commit/86cd6b35d46af861e56943ff7437189234b7b790))
* **core:** token model, DTCG parse/serialize, diagnostics (TICKET-040) ([0228559](https://github.com/Fuasmattn/design-token-authority/commit/022855976fcde000073abb68b061d7b0fe7152ce))
* **diff:** diff config section and static-site stories adapter (TICKET-081) ([dac28b1](https://github.com/Fuasmattn/design-token-authority/commit/dac28b142a7e5e171fe4de7ead96ba92f6a6f2b8))
* **diff:** dta diff tracer with token change sets (TICKET-080) ([8c61e76](https://github.com/Fuasmattn/design-token-authority/commit/8c61e76461fd03630867fdf95bfd3e81839b98de))
* **diff:** explain re-scoped CSS by token; real numbers on the landing page (TICKET-111) ([75f53cd](https://github.com/Fuasmattn/design-token-authority/commit/75f53cd6d0120a8a7c8396d02958dfe64646090b))
* **diff:** explain visual changes by token (TICKET-084) ([ff710bc](https://github.com/Fuasmattn/design-token-authority/commit/ff710bc42ed8d8ba25e4d3ee99b5793aa266f275))
* **diff:** page lists, base build without setup, --check and loud failures (TICKET-127, TICKET-128, TICKET-130) ([2674f90](https://github.com/Fuasmattn/design-token-authority/commit/2674f90aae7ad4d43839494b416ea56f6d6ebe9f))
* **diff:** publish hook and dta diff in pull requests (TICKET-086, part 1) ([35bd984](https://github.com/Fuasmattn/design-token-authority/commit/35bd9845ae201df9b0ec39614779e2dfc1677440))
* **diff:** render base and head, compare screenshots (TICKET-082) ([d5c70f6](https://github.com/Fuasmattn/design-token-authority/commit/d5c70f6d88221917f79b4cf45888559ecd3c5955))
* **diff:** report refs in words, both commits named, notes never cover the story (TICKET-123); handover ([7421f29](https://github.com/Fuasmattn/design-token-authority/commit/7421f296f0b4cb09e4000ab093900f214400b855))
* **diff:** report row shows the change in place, "Show before" swaps it (TICKET-109) ([ccc6900](https://github.com/Fuasmattn/design-token-authority/commit/ccc6900ae1fccc85cefdb45544f1745db0a4abc9))
* **diff:** review report in the Drafting Table design (TICKET-085) ([6459bed](https://github.com/Fuasmattn/design-token-authority/commit/6459bed74c6d0b9858801442924523d553985b88))
* **diff:** Storybook adapter (TICKET-089) ([90082b2](https://github.com/Fuasmattn/design-token-authority/commit/90082b2f7a739ed98fea37c482dacdaa5c0006d4))
* **docs:** port the docs HTML generator into @dta/docs (TICKET-061) ([a37fd6f](https://github.com/Fuasmattn/design-token-authority/commit/a37fd6f32d3fe270639095b2f0bf82e5567af615))
* **figma:** documented input format, JSON Schema and import adapters (TICKET-047) ([8b1caac](https://github.com/Fuasmattn/design-token-authority/commit/8b1caac7ba16835c7d99d4704a6814aec64d8335))
* **figma:** dta prune deletes variables without a token (TICKET-021) ([4d53d6d](https://github.com/Fuasmattn/design-token-authority/commit/4d53d6d6aef2402e42a6b2f2a870b1cbc069f639))
* **figma:** export Figma variables to the token model (TICKET-045) ([01a06e7](https://github.com/Fuasmattn/design-token-authority/commit/01a06e7fc00858301284bdc3264cfcb4c11d4535))
* **figma:** package scaffold and Zod-validated Figma client (TICKET-044) ([166ae3b](https://github.com/Fuasmattn/design-token-authority/commit/166ae3b879ff745a67d7011242716abcc4a6eb7b))
* **figma:** plan a push (TICKET-046) ([1063638](https://github.com/Fuasmattn/design-token-authority/commit/106363840d41bed70a9b25515936f96cecf5babd))
* **figma:** push the new types (TICKET-138) ([3da0027](https://github.com/Fuasmattn/design-token-authority/commit/3da002745871495240508007df302e50e4113d3b))
* **init:** dogfood dta init on the site (TICKET-087) ([f730a50](https://github.com/Fuasmattn/design-token-authority/commit/f730a50a1d93bed9218d851ddc9131b5ab6467aa))
* **init:** dta init sets up dta diff, one workflow file for team repositories (TICKET-129, TICKET-131) ([610bae6](https://github.com/Fuasmattn/design-token-authority/commit/610bae60c7f2bb6848e8b2e53f5df7a3040310ad))
* **lint:** color-contrast and no-duplicate-values rules (TICKET-057) ([09a8f2e](https://github.com/Fuasmattn/design-token-authority/commit/09a8f2ef7a1ac8d22bef2adda6a63b6b95919b58))
* **lint:** naming-case, naming-depth, no-spaces, collection-pattern (TICKET-019) ([a987c60](https://github.com/Fuasmattn/design-token-authority/commit/a987c607cf77fb2f3856fec7bb6fce3d18bccf46))
* **lint:** public API, README and snapshot parity tests (TICKET-058) ([bdde068](https://github.com/Fuasmattn/design-token-authority/commit/bdde068159c820cdb45cbc900f07ad821dde5cc2))
* **lint:** scaffold @dta/lint with validated config and built-in rules (TICKET-055) ([02a7fe6](https://github.com/Fuasmattn/design-token-authority/commit/02a7fe6d1c998ee9f7212f184f2e1f4992edc720))
* **lint:** semantic-must-alias and naming-pattern rules (TICKET-056) ([f3ac172](https://github.com/Fuasmattn/design-token-authority/commit/f3ac1724e1d91f2b8782bbf98823102980195588))
* **query:** rank breakpoint-only matches lower (TICKET-125) ([e54aca1](https://github.com/Fuasmattn/design-token-authority/commit/e54aca12a65b46b93e84dd39defaa9e13851b475))
* **release:** npm package build, create-dta and release workflow (TICKET-090) ([30b5b88](https://github.com/Fuasmattn/design-token-authority/commit/30b5b884813e6ee914e9003e57fba285344e7f0c))
* rename brand token files and update references to BrandA and BrandB ([15025ea](https://github.com/Fuasmattn/design-token-authority/commit/15025ea6b957f2d815bd0456669170cd9e70c0a3))
* report review verdict in signal; examples never use system colours (TICKET-121 item 4, TICKET-122) ([d055748](https://github.com/Fuasmattn/design-token-authority/commit/d0557483e7f07e72da0949719bfef3a8971013c9))
* several resolver modifiers at once (TICKET-137) ([75d4bb3](https://github.com/Fuasmattn/design-token-authority/commit/75d4bb3ad4b70ff7dc357ec03c9fd51cde3d9905))
* **site,build:** playground outputs, downloads and CLI handoff; outputs.formats (TICKET-079) ([ad3779c](https://github.com/Fuasmattn/design-token-authority/commit/ad3779c053422591740b72fa0a2119fb144d0c65))
* **site:** a selected finding keeps its severity marker (TICKET-121 item 2) ([0555d5b](https://github.com/Fuasmattn/design-token-authority/commit/0555d5b0d8603344db7899764e17c27b28c57266))
* **site:** Astro + Starlight scaffold themed by DTA-built tokens (TICKET-069) ([4b4da5f](https://github.com/Fuasmattn/design-token-authority/commit/4b4da5ff5bcf3d2adc75cced4d95597405c15b1e))
* **site:** calmer hero with npm create dta and one Get started button (TICKET-098) ([03218f0](https://github.com/Fuasmattn/design-token-authority/commit/03218f09cb9dd1ba5d44dd7bef63843839ebdcb4))
* **site:** design system on one surface, AAA (TICKET-110) ([a8e2fa4](https://github.com/Fuasmattn/design-token-authority/commit/a8e2fa4f2bc0ff976472f8c9663604d0a27a63cf))
* **site:** design system section with token pages, component docs and stories (TICKET-070) ([cabd244](https://github.com/Fuasmattn/design-token-authority/commit/cabd244708897875254faf4623fe2524939924c4))
* **site:** DTA Drafting Table as DTA token files (TICKET-068) ([9692236](https://github.com/Fuasmattn/design-token-authority/commit/9692236334e8667d2110cf8de4ca1ce3cbf8fe2b))
* **site:** example with problems, site polish, scenes follow the strip (TICKET-113, TICKET-114) ([a99766f](https://github.com/Fuasmattn/design-token-authority/commit/a99766ffdd765531f6d9730f151e0de8fb80155b))
* **site:** generated Commands and Configuration reference, published schemas, llms.txt (TICKET-074) ([b8e2466](https://github.com/Fuasmattn/design-token-authority/commit/b8e24663a0cd566bd1675632d53f5313d6d78d39))
* **site:** GitHub and agent sections instead of the review demo; type cycle in the headline (TICKET-099) ([a6c5c80](https://github.com/Fuasmattn/design-token-authority/commit/a6c5c80ab869b77704d6226e77884149bb1eb9b6))
* **site:** GravityWell and FloatingObjects, the key visual (TICKET-107) ([4aca897](https://github.com/Fuasmattn/design-token-authority/commit/4aca8976f6f1bf74d072819296af7d006f0e29cb))
* **site:** honest install command on the landing page; follow-up tickets 090-092 ([3f02117](https://github.com/Fuasmattn/design-token-authority/commit/3f02117436a32a03a4556d83041e334eae15c732))
* **site:** landing components: command chip, Scene, ExampleButton, TokenRows, Checks, Facts (TICKET-106) ([c98aa2c](https://github.com/Fuasmattn/design-token-authority/commit/c98aa2c05c0e4af6908c2001ef0e8f0e138afaa0))
* **site:** landing nav says Workflow; the hero grid drifts ([0b84368](https://github.com/Fuasmattn/design-token-authority/commit/0b84368f453e3ec05f2eb1a4dc5087e01dc3b4ee)), closes [#workflow](https://github.com/Fuasmattn/design-token-authority/issues/workflow)
* **site:** landing page from the J · Drafting Table mockup (TICKET-071) ([483eba6](https://github.com/Fuasmattn/design-token-authority/commit/483eba652ed301287dc416cdf608c5d5878f8127))
* **site:** landing page on tokens and design-system components only (TICKET-096) ([0b587c6](https://github.com/Fuasmattn/design-token-authority/commit/0b587c69d47c7cfede9706ff16d826f3245a68eb))
* **site:** motion tokens, motion rule against change blindness, playground transitions (TICKET-116) ([b7328ba](https://github.com/Fuasmattn/design-token-authority/commit/b7328ba4021f04a502508e819955ddfe72c86918))
* **site:** Nav component with a mobile menu; design-system rule in CLAUDE.md (TICKET-095) ([dba2418](https://github.com/Fuasmattn/design-token-authority/commit/dba241816c77a7df053c355f344f41cd429e901c))
* **site:** Nav with a burger button and a full-screen menu on phones (TICKET-097) ([e9cb0d0](https://github.com/Fuasmattn/design-token-authority/commit/e9cb0d0b61b965b68dccda6cf684641c67825cec))
* **site:** Orbit Burger as a real token set, built with DTA (TICKET-105) ([52c37e9](https://github.com/Fuasmattn/design-token-authority/commit/52c37e9f2daf730f103a4bf9e26c059502da7032))
* **site:** playground dependency graph (TICKET-078) ([3865399](https://github.com/Fuasmattn/design-token-authority/commit/38653991e894cc0ab7bbcd70b13606bf90266f4c))
* **site:** playground on /playground as a Preact workspace (TICKET-077, TICKET-115) ([e2537d6](https://github.com/Fuasmattn/design-token-authority/commit/e2537d6c222f04e497bdcd5347b5da6b5b27937d))
* **site:** prove the @dta/* packages run in the browser; zod namespace imports (TICKET-076) ([88f4424](https://github.com/Fuasmattn/design-token-authority/commit/88f4424bad222b713abe31c111f8893703eb475f))
* **site:** status colours for success, warning and error (TICKET-120) ([6dfd720](https://github.com/Fuasmattn/design-token-authority/commit/6dfd72002744e9c1c0d4a803b3eec6cff6e49c8e))
* **site:** the landing page on the gravity well (TICKET-108) ([daba2ff](https://github.com/Fuasmattn/design-token-authority/commit/daba2ff97aeb365aeb2cb2820b55c7b5bddf202d))
* **site:** token paths break between segments, "Not copied" error marker (TICKET-121 items 1, 3) ([3247be6](https://github.com/Fuasmattn/design-token-authority/commit/3247be6d18acaf3b58f5aa26dfb2f2275a2166a5))
* **site:** workflow strip below the hero, scenes in the same order (TICKET-112) ([3db4496](https://github.com/Fuasmattn/design-token-authority/commit/3db44962e7b3fb48c8d187e77a2c809ac90847bc))
* **testkit:** Figma API fake with recorded responses (TICKET-037) ([59b3498](https://github.com/Fuasmattn/design-token-authority/commit/59b349854e8a2da617cda2454edbaf4c0e05b6d5))
* **workspace:** pnpm workspace scaffold with @dta/core (TICKET-033) ([72f1c1a](https://github.com/Fuasmattn/design-token-authority/commit/72f1c1ab538625cfbdfa48d2934ecc84c4368a04))

### Bug Fixes

* **build:** dangling and circular aliases fail the build, nothing is written (TICKET-119) ([9eea9a7](https://github.com/Fuasmattn/design-token-authority/commit/9eea9a7728d6266f2f21e18735c7f4ff03801299))
* **ci:** commit the build reference snapshots that .gitignore was hiding ([c41f63a](https://github.com/Fuasmattn/design-token-authority/commit/c41f63a36b2c851ec1c92b56a9b6c41c3edf56a3))
* **dtcg:** follow-ups and close TICKET-132–138 ([e975ddb](https://github.com/Fuasmattn/design-token-authority/commit/e975ddb85bb5505ded86321618cdd6fa64726bd9))
* findings of the independent review of TICKET-132–138 ([009f6f7](https://github.com/Fuasmattn/design-token-authority/commit/009f6f733f1611027192f64eea2b1ff7b7745e2b))
* **playground:** two e2e races seen in CI (TICKET-139) ([e456963](https://github.com/Fuasmattn/design-token-authority/commit/e456963486de5875b44cd2ab88d82ea3ca87c9b8))
* **release:** publish create-dta with public access ([7d09c97](https://github.com/Fuasmattn/design-token-authority/commit/7d09c97a04dd408927d3e2dd00f1d4b44eace638))
* **release:** run typecheck before the tests in the release hook ([880ea4a](https://github.com/Fuasmattn/design-token-authority/commit/880ea4a4c96fffc581eed3f4387f8e1af4f50c64))
* **site:** commit the design system token pages (TICKET-070) ([55455a4](https://github.com/Fuasmattn/design-token-authority/commit/55455a43bb149bf8a211116b6667049dcb415e9a))
* **site:** narrow the well's elements for the typecheck ([d535816](https://github.com/Fuasmattn/design-token-authority/commit/d5358167a0867a0394722db7ad6bd0a68b749224))
* **testkit:** pin TERM so snapshots do not depend on the machine ([3e2d88a](https://github.com/Fuasmattn/design-token-authority/commit/3e2d88a75bd19ee6cfed3825005b295ce4e10b3e))
* track packages/build (the 'build' ignore rule had excluded it) ([edfcc95](https://github.com/Fuasmattn/design-token-authority/commit/edfcc956905b49fe23e4a41507798a146fb518ce))
* update build:cli script to use npx for tsc ([0d36458](https://github.com/Fuasmattn/design-token-authority/commit/0d3645823abfb75f77c32fe7f0e2f66ec9d74382))

### Performance

* **site:** playground analysis engine loads lazily, budgets split (TICKET-124) ([de1af40](https://github.com/Fuasmattn/design-token-authority/commit/de1af40b6c1d9f446ceb58a77456ccc26e3fdaba))

### Documentation

* @dta/core spec and tickets 040-043 (Epic 2) ([aaa74e9](https://github.com/Fuasmattn/design-token-authority/commit/aaa74e9fbf5093a15580574304c7d99c0c522c8a))
* @dta/figma spec and tickets 044-048 (Epic 3) ([82049f0](https://github.com/Fuasmattn/design-token-authority/commit/82049f01bfe6147d0d090861013d374d1a312ea9))
* 078, 121, 122 done (CI green); 111 decision: attribution through the page's own declarations ([f641e7e](https://github.com/Fuasmattn/design-token-authority/commit/f641e7e6748897c26361932e6f045e94c00aaab1))
* agent-interop spec approved; tickets 100-104 (Phase 9) ([619a1e2](https://github.com/Fuasmattn/design-token-authority/commit/619a1e20b21473f18edf7b79e71b10b5d07d864f))
* design system section in Starlight, no Storybook (spec decision 6, TICKET-070) ([1c3ef8a](https://github.com/Fuasmattn/design-token-authority/commit/1c3ef8a550b760ad5603e8aa91c4371159ecdd37))
* **diff:** attribution spike findings, element-level by revert (TICKET-083) ([b588fb7](https://github.com/Fuasmattn/design-token-authority/commit/b588fb78117c4a941b3d88167d7921766c01d495))
* **diff:** document the publish field of result.json (TICKET-086) ([5894604](https://github.com/Fuasmattn/design-token-authority/commit/5894604a2f56d57ce1d38c4e41dbc4144c9d9ab3))
* **diff:** publish hook template for any host (TICKET-086) ([c59b449](https://github.com/Fuasmattn/design-token-authority/commit/c59b44905a9578424b5d83afe667226c442889e5))
* **diff:** spec and tickets for near-zero dta diff setup (TICKET-126–131) ([ee5219e](https://github.com/Fuasmattn/design-token-authority/commit/ee5219e2f646dc971aef9ede1efff25b12086974))
* **dtcg:** spec and tickets for DTCG 2025.10 support (TICKET-132–138) ([c541d67](https://github.com/Fuasmattn/design-token-authority/commit/c541d67bc08b194b7457ff7656d9a8db91ffae0d))
* Epic 4 spec and tickets for @dta/build (049-054) ([7931eb2](https://github.com/Fuasmattn/design-token-authority/commit/7931eb2df60c8de407c351eea3c42eb476b481f7))
* Epic 5 spec and tickets for @dta/lint (055-058) ([799a156](https://github.com/Fuasmattn/design-token-authority/commit/799a1562cfdf3e88be9383867285dbae6868dd0b))
* Epic 6 spec and tickets for CLI parity (059-066) ([ad751fe](https://github.com/Fuasmattn/design-token-authority/commit/ad751fe0ebe9096812db935e6fe71c2a681b4ccc))
* handoff for the landing key visual (orbit loop) and the prototypes behind it ([674d6e8](https://github.com/Fuasmattn/design-token-authority/commit/674d6e8d842ee9a2596de1cb4d25620ff19cdf18))
* handover for the next session ([18f5f00](https://github.com/Fuasmattn/design-token-authority/commit/18f5f00a5d64a70dfb8ad7151d338282754b52ec))
* landing redesign spec, concept notes and tickets 105-109 (Phase 10) ([18903f3](https://github.com/Fuasmattn/design-token-authority/commit/18903f37c408b36c0a42730e89dfa43bfca21e63))
* **landing:** hero key visual prototype p17 (whirlpool well, page follows it) ([29edd60](https://github.com/Fuasmattn/design-token-authority/commit/29edd60ba1a3462b8379b41852f1bb9f15d8a603))
* **landing:** hero key visual prototype p6 (fine-tuning round 1) ([bc5d2f4](https://github.com/Fuasmattn/design-token-authority/commit/bc5d2f4dfe6a07971e0161f2c1de15a17d4ddd51))
* **landing:** spec revision for the gravity-well key visual; tickets 106-108 rewritten, 110 added ([04435cc](https://github.com/Fuasmattn/design-token-authority/commit/04435cc35b34ef308a654403a3c232c6f8c29239))
* legacy removal ticket with parity table and delete-as-you-go (TICKET-039) ([94aa337](https://github.com/Fuasmattn/design-token-authority/commit/94aa3371573cb3e3c56dbc9172f81271ab893e69))
* plan token engine overhaul (spec, ADRs, Epic 1 tickets) ([8b856ab](https://github.com/Fuasmattn/design-token-authority/commit/8b856abcf23956c4f95d5c2426d8861115a450f6))
* **plan:** playground on its own route as a Preact island; TICKET-077 updated ([69b7f29](https://github.com/Fuasmattn/design-token-authority/commit/69b7f295fb773ed801510dbf8228fd181cd6c32b))
* **plan:** playground workspace decision and boards; tickets 079, 113, 114, 115 ([db2c397](https://github.com/Fuasmattn/design-token-authority/commit/db2c39727801d49793d6c49fed0eff86ff8779de))
* **plan:** settle playground open questions, add TICKET-112 workflow strip ([945ed4b](https://github.com/Fuasmattn/design-token-authority/commit/945ed4b4824418b9f5904735b6773812a3c5c956))
* **plan:** TICKET-116 motion, 117 css prefix, 118 init formats; 114 extended ([6aa51c5](https://github.com/Fuasmattn/design-token-authority/commit/6aa51c5652e22bfb773aea8336c03206cbfea0fc))
* **plan:** TICKET-119 build must not write broken CSS for broken aliases ([cb0780e](https://github.com/Fuasmattn/design-token-authority/commit/cb0780ec95debedf8bb0e6638165ee2fcf756bd9))
* **plan:** TICKET-120 status colours, proposal board with checked contrasts ([ab64258](https://github.com/Fuasmattn/design-token-authority/commit/ab64258a31b376980bfd795e2fe96c1a8a2204e8))
* **site:** Learn down to two short pages that link to the sources (TICKET-073) ([833df28](https://github.com/Fuasmattn/design-token-authority/commit/833df2801ce950cabf2c03301001f87a78b10e9e))
* **site:** Learn section, DTCG intro and token pattern catalogue (TICKET-073) ([0c6f94c](https://github.com/Fuasmattn/design-token-authority/commit/0c6f94cd710079459474d18403d2ee2515f7e3f1))
* **site:** Start, Guides, Reference and Contribute; slim README (TICKET-072) ([76f8804](https://github.com/Fuasmattn/design-token-authority/commit/76f8804dc98f072d53c76953b39fded095859a1c))
* **spec:** agent interop draft (token queries, skill, project context, code audit; MCP deferred) ([9ab8b62](https://github.com/Fuasmattn/design-token-authority/commit/9ab8b62dad2273cd17b651b52b4ccfe9e6ed9a30))
* specs and tickets for Epic 7 (website), 7b (playground) and 8 (dta diff) ([78a0a74](https://github.com/Fuasmattn/design-token-authority/commit/78a0a748faec1ef93ab155d4d554ba95132e3fd8))
* TICKET-121 polish ticket, TICKET-078 scope and graph design board ([f2e70a6](https://github.com/Fuasmattn/design-token-authority/commit/f2e70a63410be871e9e3cdd264e3f4a89a40e3cb))
* **tickets:** close TICKET-006 as obsolete ([7444ddc](https://github.com/Fuasmattn/design-token-authority/commit/7444ddc0bccb2ac2569b61cd9d4b82099d0754ee))

### Tests

* **cli:** build test no longer depends on the terminal's box characters ([869e5e6](https://github.com/Fuasmattn/design-token-authority/commit/869e5e629084b3d8a8ec6c0709dedaed850ddfe4))
* find the playground entry by file; strip colours in the package test ([6df01a2](https://github.com/Fuasmattn/design-token-authority/commit/6df01a21202f258a8911838613e1ef361d8fb243))
* **fixtures:** add brand-ab and daisyui parity fixtures (TICKET-034) ([ae71492](https://github.com/Fuasmattn/design-token-authority/commit/ae714926f07ef816f1c2ae3766ba0f86baa6cdaf))
* **init:** accept either note border in the hand-written section test ([0e0fedf](https://github.com/Fuasmattn/design-token-authority/commit/0e0fedf3b85ebf033dfdad2026dd98cd57d560f7))
* **init:** read wrapped notes with Unicode borders too (TICKET-131) ([9358376](https://github.com/Fuasmattn/design-token-authority/commit/93583768e315ee0c83166c2e94ee82b35bae33ba))
* **site:** make the problem-example tests independent of the terminal and of render timing ([7c89b33](https://github.com/Fuasmattn/design-token-authority/commit/7c89b33d880105c2369ba8708eb1899ad5f24c07))
* **site:** sticky tab bar test waits for a scrollable page (TICKET-124) ([4c3f1fd](https://github.com/Fuasmattn/design-token-authority/commit/4c3f1fd82c9b30215a4d06180e10e84ed22d3c0f))
* **snapshots:** capture legacy pipeline snapshots (TICKET-035) ([b984f5f](https://github.com/Fuasmattn/design-token-authority/commit/b984f5f7ca3569f6016412b93bc84006a06611c2))

## Unreleased (2.0.0)

### ⚠ Breaking changes

* Rewrite as `@dta/*` packages behind one CLI; the v1 source tree is removed (TICKET-039). Config validation is stricter (unknown keys are rejected). See [docs/migration/v1-to-v2.md](docs/migration/v1-to-v2.md).
* Removed the repository scripts `build`, `build:cli` and `prepare` that only served v1.
* Removed the config key `outputs.css.prefix` (TICKET-117). It was accepted but never had an effect; a config that still sets it now fails with exit code 2 (`outputs.css.prefix: was removed …`). Delete the line; the CSS output does not change.
* `color-contrast` checks every pair per mode, through aliases (TICKET-092); before, it compared raw hex tokens only and the last mode read won. A project can get new contrast findings (each names its mode, e.g. `… is below 4.5:1 in BrandA`); with `severity: 'error'` they fail `dta lint` and `dta push`. A pair it cannot read is now a `contrast-unresolved` warning instead of being skipped silently.
* Removed the config key `outputs.tailwind.version` (TICKET-091). It was accepted but never had an effect (`outputs.formats` chooses `tailwind-v4`, `tailwind-v3` or both); a config that still sets it now fails with exit code 2 (`outputs.tailwind.version: was removed …`). Delete the line; the output does not change. `dta init` no longer writes it.

### Features

* **091:** `breakpoints` in the config writes a breakpoint collection (e.g. `ScreenType`) to `variables.css` as media blocks: the default mode on `:root`, every other mode inside its media query, aliases as `var()` references; Tailwind v4 gets an `@theme inline` block for it, and themes repeat breakpoint tokens that alias brand tokens per media query.

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
