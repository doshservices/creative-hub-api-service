# Claude Code setup for the marketplace backend

## What's here

```
CLAUDE.md                       loaded every session — commands, layout, invariants
.claude/rules/                  loaded only when Claude opens a matching file
  mongo-repositories.md         → src/modules/**/*.repository.ts, *.model.ts
  http-routes.md                → src/modules/**/*.routes.ts, *.controller.ts
  tests.md                      → src/**/*.test.ts
.claude/skills/                 loaded only when the task matches the skill's description
  module-scaffold/              adding a domain module end to end
  mongo-data-layer/             modelling, indexes, pagination, aggregation, transactions
  money-and-ledger/             wallet, payments, idempotency, holds, reconciliation
  third-party-provider/         Prembly, Sendco, webhooks, retries, jobs
  test-suite/                   how to test this codebase
  pre-pr-review/                self-review before shipping
```

Copy all of it to the repository root and commit it. `.claude/rules/` and `.claude/skills/` are
team-shared through version control, so everyone gets the same behaviour.

## Before you commit

1. Replace every `⟨FILL⟩` in `CLAUDE.md` with the real command from `package.json`. A wrong command is worse than no command — Claude will run it and report a phantom failure.
2. Confirm the folder layout section matches the repo. If your modules use `*.route.ts` (singular) or a `handlers/` folder, fix both `CLAUDE.md` and the `paths:` globs in `.claude/rules/`. Globs that match nothing fail silently.
3. Delete anything that isn't true yet. If there's no RBAC permission list, no ledger, or no job queue in the repo today, cut those lines and add them back when the code exists. Instructions describing a codebase that doesn't exist make Claude invent it.
4. Run `/context` in a session and check that `CLAUDE.md` appears under **Memory files**. Run `/skills` to confirm the six skills are listed.

## Why this is shaped differently from the original document

The original was a good engineering standards document and a poor CLAUDE.md, because the two have
opposite goals. CLAUDE.md is loaded into context at the start of every session and consumes budget on
every turn, so Anthropic's guidance is to keep it under ~200 lines and limit it to what Claude would
get wrong without being told. Three things followed from that:

- **Cut what the code already says.** Module lists, the folder tree, "MongoDB is the source of truth", "use JWT" — Claude reads the repo. Those lines cost context and change nothing.
- **Cut what can't be verified.** "Write readable code", "secure by default", "production-ready", "prefer composition over inheritance" don't change output, because there's no behaviour they rule out. Specific and checkable replaces them: cursor pagination on every list, integer minor units, repositories are the only Mongo access, ownership checked against the loaded document.
- **Move procedures to skills.** "How to add a module", "how to integrate a provider", "how to review a diff" are multi-step workflows needed a few times a week, not every turn. As skills, only the name and description sit in context (~100 tokens each) and the body loads when the task matches. That's how you keep the depth without paying for it constantly.

The strongest parts of your original — ledger discipline, audit immutability, async provider calls,
redaction rules — are all still here. They just moved to where they'll actually get followed.

## Working with it

- When you correct Claude twice on the same project fact, that fact belongs in `CLAUDE.md` (or a rule, if it's path-specific). Once is a bad session; twice is a missing instruction.
- Keep the invariants list under review. When a rule stops being true, delete it — contradictory instructions get resolved arbitrarily, which is worse than silence.
- `/doctor` proposes trims for a checked-in CLAUDE.md if it drifts back toward documentation.
- Auto memory (on by default) accumulates its own notes per repo at `~/.claude/projects/<project>/memory/`. Skim it occasionally with `/memory`; it's plain markdown and it's where discovered build quirks end up.
- These skills work in Claude Code and in the Claude apps. If you want any of them available outside this repo, copy the folder to `~/.claude/skills/`.

Docs: https://code.claude.com/docs/en/memory and https://code.claude.com/docs/en/skills
