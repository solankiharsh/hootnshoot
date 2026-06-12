# Contributing

Development workflow for this fork lives alongside the monorepo under `./app`. Use the root repository **Makefile** for local infra (`make infra-up`, `make dev-backend`, etc.) when integrating backend or frontend changes.

1. Open an issue or internal ticket describing the change.
2. Branch from `master`, implement with focused commits.
3. Run the checks your team expects (`pnpm` build/test from `./app` when touching application code).
4. Open a pull request for review.

For structural questions, see the repository root `README.md` and `docs/setup.md`.
