## What and why

<!--
One or two sentences on what changes and why it is worth merging. Focus on the problem being solved —
a reviewer should understand the intent before reading the diff.
-->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Build, packaging, or CI

## How this was tested

<!--
Be specific and honest. "Ran the app and did X, observed Y" beats "should work".
Name the platform you tested on if the change is platform-sensitive.
-->

## Screenshots

<!-- Required for any UI change. Before/after if the current behavior is being changed. Delete if not applicable. -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes, and new logic ships with a suite under `test/`
- [ ] I ran the app and exercised the change (or explained above why I could not)
- [ ] One concern per PR — no unrelated refactors or reformatting in this diff
- [ ] Docs updated where they are now wrong (`README.md`, `docs/ARCHITECTURE.md`, `docs/CONFIGURATION.md`, `docs/DEVELOPMENT.md`, `CHANGELOG.md`)
- [ ] No new runtime dependency, or the PR description justifies it

## Trust boundaries

<!--
Red Sky runs an agent with shell access. Answer both:

1. Does this widen any boundary — the preload allow-list, an IPC handler's validation, the workspace
   path guard, or the Auto Review policy?
2. Does it change what an agent can reach outside the workspace?

If yes, explain why. If no, say "none".
-->

None

## Notes for reviewers

<!-- Optional: the part of this diff you are least sure about, or where you would like extra scrutiny. -->
