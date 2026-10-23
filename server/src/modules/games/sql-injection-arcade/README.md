# SQL Injection Arcade server rules

## Presentation summary

- Server-only bounded teaching parser and saved-attempt ruleset
- Stable game ID `sql-injection-arcade`, ruleset `sql-1`
- CS440 `12a-web-security-partII.pptx` slides 16–24 support the injection/parameter discussion
- `parser.js` recognizes a quote breakout, OR, literal equality and trailing `--`
- `ruleset.js` owns the five-test cap, repair choice and 80+20 scoring
- Uses the existing attempt API/store, ownership, CSRF, revisions and receipts
- Personal and eligible class context are fixed at creation
- Untimed `practice`, no deadline and no ranking eligibility
- Raw fictional input is evaluated transiently and never saved or returned
- Review status and evidence: [GAME-01-B / G-SQL](../../../../../TASKS.md#g-sql-saved-practice)

## API and data flow

The production registry additively registers this one game. Existing other games keep their original contracts. Start with `POST /api/games/sql-injection-arcade/attempts {context}`; read, act and complete through the [shared attempt contract](../../attempts/README.md). The earlier proposed `/api/sqli-test` endpoint is superseded; there is no parallel scoring or persistence API.

Actions use `{actionId,expectedRevision,type,payload}`. `test-payload` accepts exactly `{username,password}`, both strings at most 120 characters; `select-repair` accepts exactly `{optionId}` from the server-supplied options. Repair is available only after a bypass or five tests, and can be chosen once. Completion requires the repair selection. Server scoring is 80 for a bypass and 20 for `bind`; replay starts a different attempt.

Private strict state stores `{scenarioId,testCount,bypassAchieved,repairOptionId,evaluations}`. Evaluations are bounded outcome codes only. Public state explicitly exposes counts, evaluation codes, phase flags and repair option labels. It excludes the private repair selection and raw credentials. Saved receipts store public snapshots and request hashes, never input bodies. Final feedback explains the correct repair. Inputs do not touch real authentication, SQL/database execution, shell commands or external services.

## Teaching grammar

After the first quote, accept case-insensitive `OR`, two integer literals (at most 12 digits) or two quoted string literals (at most 80 characters, doubled quote escaping), `=` and a trailing `--`, with optional whitespace. Both operands must have the same type. Compare their literal values; `OR` alone never guarantees success. Ordinary quote-free input remains data and does not match fictional credentials. Any unsupported field syntax rejects the combined teaching evaluation. No more than 32 tokens; the accepted shape has five. Reject malformed quoting, mixed literal types, stacked statements, extra expressions or text after the comment marker. This is a documented teaching subset, not a complete SQL dialect or a vulnerability scanner.

The UI's query illustration redacts mock password content and explains quote/condition/comment roles using fixed text. Never pass user input through `eval`, SQL drivers or untrusted HTML. The course's deliberately unsafe examples are illustrations and do not describe production password handling.

## Verification

Unit checks cover true/false equality, quoted `OR` text, malformed/unsupported syntax, bounds, phases and scoring. API checks cover persistence, receipt deduplication, concurrent completion, premature completion, private-state serialization, another account's IDs, class eligibility/removal, sessions, origin and CSRF. Browser checks cover successful and exhausted attempts, repair, saved reload/replay, responsive sizes and keyboard entry. Exact commands/outcomes live in TASKS.md; all database checks use the guarded disposable `_test` runner.

## Retained parser limitation

`evaluateLogin` evaluates both fictional fields and returns `UNSUPPORTED` if either field is unsupported. Consequently, a valid username bypass followed by a comment can still be rejected because of the password's syntax, even though the displayed teaching explanation describes that suffix as commented out. No real SQL is executed. The proposed ordered-query parser correction was cancelled before implementation; see the TASKS handoff record. The current registered ruleset remains `sql-1`.
