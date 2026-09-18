# The Sharlock Gazette

Cyber News Central retains catalog ID `threat-briefing` and `/games/threat-briefing`. Its paper reads live Guardian stories, without accounts, scores, reflections or saved reading history.

## Presentation walkthrough

1. `Dashboard.vue` remains mounted at `/` while its nested news route opens `NewsDialog.vue`
2. `NewsDialog.vue` calls native `showModal()` and owns Escape/Close; Dashboard owns Back versus direct-link replacement and restores the newsstand focus
3. `CyberNewsCentral.vue` composes the newspaper, sections, feedback, story grid and pagination
4. `useNewsLocation.js` validates URL filters and searches/pages the loaded edition without HTTP calls
5. `useCyberNews.js` cancels superseded Axios requests, enforces browser content expiry and disposes its timer/listener/request
6. `news.js` reuses the shared `/api` Axios client; the [server news module](../../../../server/src/modules/news/README.md) owns upstream access, secrets and persistence

## Component contracts

| Component        | Inputs                                                                    | Events / responsibility                                                 |
| ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `NewsDialog`     | none                                                                      | `request-close`, native modal lifecycle                                 |
| `NewsFilters`    | section, range, query, loading, canRefresh                                | section/range/query updates, refresh; mobile Browse & search disclosure |
| `NewsArticle`    | article, featured                                                         | full title, inline byline/excerpt, safe publisher links and dates       |
| `SafeInline`     | nodes                                                                     | escaped text, safe links and line breaks; no raw HTML                   |
| `NewsPagination` | page, pageCount                                                           | update:page                                                             |
| `NewsStatus`     | loading, error, stale, partial, fetchedAt, refreshAvailableAt, canRefresh | retry and honest cache/error feedback                                   |

Newspaper query fields are `section=cybersecurity|technology`, `range=week|month`, `q` (up to 80 characters) and `page` (1–5). Defaults are omitted from the URL. Filter changes replace the current history entry. Each edition contains at most 50 stories, with ten per page. Dates use Asia/Singapore.

## Integration boundaries

Shared changes are limited to the existing router, Dashboard, PortalLayout focus handling, TownMap activation/focus methods, catalog/card and town links. The original newsstand SVG follows the shared asset convention in `client/public/images/town/newsstand.svg`; no second registry or camera is introduced. Other activity previews retain their existing card behaviour. The paper uses shared pixel tokens through `.news-dialog`-prefixed CSS; it never styles the document body or another page.

Unit tests live in `__tests__/news.test.js`; browser journeys live in `tests/e2e/news.spec.js`. Deterministic stories are test fixtures only. The actual app never silently substitutes fixtures for live news.

## Credits and deferred work

The pixel newsstand is original code-based artwork, using the existing capybara palette. Newspaper icons and mascot reuse the project's original assets. Publisher attribution links to The Guardian and uses its official [Powered by logo](https://www.theguardian.com/open-platform/logos). [Provider access](https://open-platform.theguardian.com/access/) and [provider terms](https://www.theguardian.com/open-platform/terms-and-conditions) govern this integration.

A possible future headline Q&A assistant using a browser-local LLM is deferred. Boey will investigate browser capability and source permissions separately. There is no model download, inference dependency, chat UI or hidden assistant integration in this module.
