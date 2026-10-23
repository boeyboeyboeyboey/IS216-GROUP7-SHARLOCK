# Code readability guide

**Version 1 · approved 13 October 2026**

This guide is the single authority for code readability and staged maintenance reviews in Sharlock Hub. It aims for explainable, behaviour-preserving code, not the shortest possible code. These are team engineering standards, not course or assessment requirements. An approved readability review covers only its stated paths and behaviour; it does not authorize a project-wide rewrite or bypass a feature's ownership and collision rules.

## Readable code

- Choose descriptive names for values and actions. Name a meaningful boolean when it makes a decision easier to understand; existing names such as `canSend` are a good pattern. Avoid needless aliases, wrappers, or layers that only rename a one-line operation.
- Keep functions cohesive. Extract a helper when it gives a meaningful name to a reusable or non-obvious step; do not impose arbitrary function, file, or line limits. Keep ordinary JavaScript and Vue features when they communicate the intent clearly.
- Do not use nested ternaries in new or revised expressions. A simple ternary for one clear choice is fine. Leave existing nested ternaries outside the approved paths and behavior untouched, even when another part of that file is in scope; record a worthwhile cleanup as a separate follow-up instead of widening the batch.
- Prefer guard clauses and early returns when they make exceptional cases clear. More than two nested decision levels is a review trigger, not a hard nesting limit; DOM/template structure is not counted as decision nesting. Keep a branch nested when flattening would obscure ownership, order, or an invariant.
- In Vue, move complex derived logic into a pure `computed` value so it stays reactive. Use named functions for actions and per-item parameters. Small, obvious inline bindings are fine; avoid hiding multi-step decisions in templates. Do not replace reactive values with stale plain constants.
- Keep route handlers thin: validate through focused functions or middleware, then delegate feature behavior to services. Preserve request, response, status, and error contracts. Express 5 propagates rejected route-handler promises to error handling; do not add mechanical `next(error)` wrappers solely to forward them.
- Prefer Bootstrap utilities for ordinary grid, layout, and spacing when they improve clarity and use the existing design tokens. Keep the current component contracts in DESIGN.md, town presentation, and intentionally custom game themes and module-scoped styles. A readability change must not flatten a design boundary into generic defaults.
- Use semantic HTML elements where they express the content or control. A `div` remains appropriate for layout. Preserve landmark hierarchy, native buttons, keyboard and touch access, visible focus, and accessible names.
- Preserve behavior and all existing security, scoring, API, accessibility, request, timer, cancellation, and cleanup guarantees. Simplifying code is not a reason to loosen validation or change an edge case.
- Follow the existing code-comment rule in `agents.md`: comments are minimal, strictly lowercase, and have no trailing full stop; explain only complex logic or MEVN routing/data flow.
- Keep a short module README when it helps a presenter explain the feature's client/server flow and boundaries.

These guidelines do not require automatic rewrites of existing code. Apply them to new code and to files included in an explicitly approved maintenance batch. There is no new lint gate, dependency, universal formatting transformation, or feature implementation authorized by this guide.

When planning or implementing an approved maintenance batch, ask focused questions about intended behavior and design when needed; clarify material discoveries before changing the agreed behavior or scope. Follow [agents.md §2.D](agents.md#d-clarify-and-confirm-before-coding) and do not repeat approval requests for an unchanged scope.

## Staged maintenance workflow

1. **Audit read-only.** Read the current policy and the selected feature's code, tests, owner notes, and relevant task record. Limit the audit to one user flow or a coherent small area; do not audit the whole repository by default.
2. **Propose.** Give the contributor up to three worthwhile, bounded simplification options. For each, name the files, explain the readability gain, state the behaviour and invariants that stay unchanged, and identify the narrow checks. Say clearly when no change would help.
3. **Agree scope.** The agent presents up to three worthwhile changes with paths, unchanged behavior and narrow checks, then asks the owner to approve a specific plan. For example: “I reviewed `[paths]` under policy v1. I recommend `[change]` in `[paths]`; `[invariants]` stay unchanged, and I will run `[checks]`. Do you approve this scope?” The contributor approves, adjusts, or declines; they do not need to author the proposal. Obtain their agreement and explicit scope approval before editing. A prior feature approval is not readability approval. This maintenance path applies only to existing-code review; it does not weaken the new-feature collision guardrail. The Social simulator's separately owned `llm/` engine remains gated by its contributor's agreement.
4. **Change one batch.** Work on one user flow, usually a few related files. Preserve unrelated and uncommitted work. Keep each batch small enough to review as a short walkthrough.
5. **Verify and explain.** Run the narrow checks named in the approved scope. Show the diff and provide a concise walkthrough of what became easier to follow, what behavior is preserved, the actual verification, and the next action. Record the policy revision, reviewed commit and paths (or a snapshot identifier for uncommitted scope), approval, and check evidence in `TASKS.md`.
6. **Stop.** Do not continue into another area without a separate proposal and approval. Do not repeatedly prompt about an unchanged scope already reviewed under the current policy. Reopen review only for a material new diff, policy change, or unresolved finding.

## Existing and in-progress branches

For an older or in-progress branch, preserve local and uncommitted changes. Before its completion or publication, inspect the latest readability policy on `main` read-only; compare documentation or fetch for comparison only when needed. Never blindly pull, checkout, reset, or overwrite the contributor's branch. Review only that branch's feature changes, not the entire codebase. If its code has not been reviewed under the current policy, the agent presents a short proposal with up to three worthwhile simplifications and asks the contributor to approve the scope, even if the branch was already pushed. If the reviewed changes need no simplification, record that conclusion and its paths; do not manufacture work.

From 13 October 2026, new branches use `<task-id>-<description>` in lowercase and omit the `codex/` prefix, as Boey requested. Preserve historical branch names in old records.

## Human review checklist

Markdown cannot inspect an unreviewed branch automatically. For each approved batch, the reviewer checks:

- The change matches the agreed paths and proposal, and unrelated work remains intact.
- New/edited logic reads plainly without nested ternaries or complex decisions embedded in templates; any deeper nesting has a clear reason.
- Route/service responsibilities remain clear, and API/error behavior is unchanged.
- UI retains its semantic controls, accessibility, shared theme or isolated game theme, and responsive behavior.
- Security, score rules, timers, requests, cancellation, and cleanup retain their prior guarantees.
- The narrow checks pass, their exact results are recorded, and the walkthrough is short enough to review before the next batch is proposed.

## References

- [Vue computed properties](https://vuejs.org/guide/essentials/computed)
- [Express 5 error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [Bootstrap 5.3 utilities API](https://getbootstrap.com/docs/5.3/utilities/api/)
- [MDN `section` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/section)
