# Social Engineering Simulator - client module

## Presentation summary

- What it is: G-SOC, a chat where the player is pressured by a fictional colleague to hand over a synthetic reset code, then picks a decision.
- How to play: read the scenario brief, chat with the pressuring contact, optionally message a real colleague in a second tab to verify the request, then choose "Refuse and end", "Verify through a known channel" or "Share the code" (`simulator.js`).
- Limits: messages are capped at 1000 characters; the server scores the run and shows a debrief.
- Technical: `SocialEngineeringSimulator.vue` uses `composables/useSocialEngineeringSession.js` and `useVerifierChat.js`, and calls the API through the shared Axios client (see the [server module](../../../../server/src/modules/games/social-engineering-simulator/README.md)).
- Status: playable and unsaved (no attempt is stored), merged to `main` via PR #3.

## File map

- `SocialEngineeringSimulator.vue`: game entry, routed at `/games/social-engineering-simulator`.
- `simulator.js`: API wrappers, decision list and limits.
- `composables/`: session state and the real-colleague chat state.
- `components/`: `ScenarioBrief`, `ConversationTabs`, `ChatThread`, `MessageComposer`, `DecisionBar`, `DebriefPanel`.
- `sim.css`: game-scoped styles.
- `__tests__/`: component, session and verifier tests.
