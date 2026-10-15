# Strangler rewrite instead of in-place refactor

The token engine overhaul is a fresh rewrite in a new package structure, not a refactor of the flat `src/` tree. The legacy code stays frozen and runnable as a behaviour reference until the new CLI reaches feature parity (proven by golden-file tests), then it is deleted. We chose this because clean module APIs are easier to design from scratch than to carve out of legacy entrypoints, while the old tests and outputs still guard against regressions. Modules like color parsing, the dependency graph and export/import may be ported where they fit.

New features (open tickets 011–013, 019, 021, 024, 028–032) wait until parity is reached.
