import { createAttemptRegistry } from './registry.js'
import { sqlRuleset } from '../games/sql-injection-arcade/ruleset.js'

export function createProductionAttemptRegistry() {
  return createAttemptRegistry([sqlRuleset])
}
