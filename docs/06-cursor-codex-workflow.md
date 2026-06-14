# Cursor and Codex Workflow

## Main Rule

Never ask Cursor or Codex to build the whole project.

Always use:

1. Plan first.
2. Implement one small step.
3. Review.
4. Test.
5. Commit.

## Cursor Usage

Use Cursor for:

- Creating files.
- Implementing small features.
- Editing Flutter screens.
- Editing Express modules.
- Fixing errors from terminal.
- Refactoring small modules.

Always start Cursor prompts with:

Read AGENTS.md and the relevant docs.
Do not write code yet.
Create an implementation plan and list affected files.

## Codex Usage

Use Codex for:

- Reviewing architecture.
- Reviewing Prisma schema.
- Reviewing API design.
- Reviewing security.
- Generating tests.
- Checking if implementation follows AGENTS.md.

## Good Cursor Prompt Template

Task:
[Describe one small task]

Context:
- @AGENTS.md
- @docs/02-architecture.md
- @docs/04-api-conventions.md
- [specific file or folder]

Requirements:
- [requirement 1]
- [requirement 2]
- [requirement 3]

Constraints:
- Do not modify unrelated files.
- Do not add dependencies unless approved.
- Do not change database schema unless requested.

Output:
1. Plan
2. Affected files
3. Questions if any

Do not write code yet.

## Implementation Prompt

Implement step 1 only.

After implementation:
1. List changed files.
2. Explain how to test.
3. Mention missing pieces.

## Token Saving Rules

- Do not include the whole codebase in context.
- Use specific files and folders.
- Keep each chat focused on one task.
- Use .cursorignore.
- Keep rules short.
- Start new chat for new feature.
- Use docs as stable context instead of repeating long explanations.

## Bad Prompts

Bad:

Build the whole app.

Bad:

Create the authentication system.

Bad:

Fix everything.

## Good Prompts

Good:

Implement public registration for LEARNER and SUPPLIER only.

Good:

Create Express module skeleton for materials. Do not implement search yet.

Good:

Review this Prisma schema for role and delivery issues. Do not edit files.