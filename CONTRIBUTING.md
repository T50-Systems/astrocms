# Contributing to T50-Systems projects

Thanks for helping improve a T50-Systems project. These guidelines apply across repositories unless a project provides more specific instructions.

## Before you start

1. Read the repository README and any architecture, planning, or agent guidance files.
2. Check existing issues and pull requests to avoid duplicate work.
3. For large changes, open an issue or discussion first and agree on scope.
4. Keep credentials, customer data, local session files, and other secrets out of commits.

## Development workflow

1. Fork or create a branch from the repository's default branch.
2. Install dependencies using the package manager and lockfile already used by the project.
3. Make the smallest coherent change that solves the problem.
4. Add or update tests for changed behavior.
5. Run the repository's documented validation commands before opening a pull request.
6. Update documentation, changelogs, or examples when behavior changes.

## Commit and PR expectations

- Prefer clear Conventional Commit-style messages, for example `fix: handle empty input` or `docs: update setup guide`.
- Keep unrelated work in separate pull requests.
- Explain user-visible behavior, migration concerns, and validation performed.
- Link related issues with `Fixes #123` or `Refs #123` when applicable.
- Do not include generated artifacts, local caches, or environment-specific files unless the repository explicitly requires them.

## Pull request checklist

Before requesting review, confirm:

- [ ] The change is scoped and understandable.
- [ ] Tests or a rationale for not adding tests are included.
- [ ] Validation commands were run and results are documented.
- [ ] Documentation was updated for user-facing behavior.
- [ ] No secrets, tokens, private keys, session transcripts, or local-only files are committed.

## Review expectations

Maintainers may ask for changes to improve correctness, maintainability, security, or project fit. Reviews are collaborative; address feedback with follow-up commits or a clear explanation.

## License

By contributing, you agree that your contributions are provided under the license of the target repository.
