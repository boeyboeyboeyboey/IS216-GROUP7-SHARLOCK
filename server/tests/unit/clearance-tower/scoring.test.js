import { describe, expect, it } from 'vitest'
import { findLevel, LEVELS } from '../../../src/modules/games/clearance-tower/levels.js'
import { scoreLevel, starsFor } from '../../../src/modules/games/clearance-tower/scoring.js'
import { simulateDay } from '../../../src/modules/games/clearance-tower/simulate.js'
import { SOLUTIONS } from './solutions.js'

function play(levelId, policy, predictions) {
  const level = findLevel(levelId)
  return scoreLevel(level, policy, predictions, simulateDay(level, policy))
}

describe('clearance tower scoring', () => {
  it.each(LEVELS.map((level) => level.id))('scores the known solution for %s', (levelId) => {
    const { policy, predictions, score } = SOLUTIONS[levelId]
    const result = play(levelId, policy, predictions)
    expect(result.score).toBe(score)
    expect(result.meters.leaks).toBe(0)
    expect(result.breakdown.reduce((total, row) => total + row.max, 0)).toBe(100)
  })

  it('caps the trojan level below three stars whatever the access lists say', () => {
    const { predictions } = SOLUTIONS['the-gift']
    const level = findLevel('the-gift')
    const asGiven = play('the-gift', level.startPolicy, predictions)
    expect(asGiven).toMatchObject({ score: 80, stars: 2 })
    expect(asGiven.meters.leaks).toBe(1)
    expect(play('the-gift', SOLUTIONS['the-gift'].policy, predictions).stars).toBe(2)
  })

  it('charges for excess rights and wrong predictions', () => {
    const { policy } = SOLUTIONS['the-matrix']
    const generous = {
      grants: [...policy.grants, { subject: 'contractor', object: 'payroll', rights: ['r', 'w'] }],
    }
    const result = play('the-matrix', generous, { p1: 'allow', p2: 'deny', p3: 'allow' })
    expect(result.meters).toMatchObject({ leaks: 1, excessRights: 2, correctPredictions: 2 })
    expect(result.breakdown).toEqual([
      { key: 'leaks', label: 'No leaks', max: 40, points: 20 },
      { key: 'work', label: 'Work completed', max: 30, points: 30 },
      { key: 'privilege', label: 'Least privilege', max: 15, points: 5 },
      { key: 'predictions', label: 'Predictions', max: 15, points: 10 },
    ])
  })

  it('never goes below zero when everything leaks', () => {
    const everything = {
      grants: findLevel('the-matrix').agents.flatMap((agent) =>
        findLevel('the-matrix').files.map((file) => ({
          subject: agent.id,
          object: file.id,
          rights: ['r', 'w'],
        })),
      ),
    }
    const result = play('the-matrix', everything, { p1: 'allow', p2: 'allow', p3: 'deny' })
    expect(result.breakdown.find((row) => row.key === 'leaks').points).toBe(0)
    expect(result.breakdown.find((row) => row.key === 'privilege').points).toBe(0)
    expect(result.score).toBe(30)
  })

  it('gives mandatory levels no privilege row and scores predictions out of 30', () => {
    const { policy, predictions } = SOLUTIONS.compartments
    const result = play('compartments', policy, predictions)
    expect(result.breakdown.map((row) => row.key)).toEqual(['leaks', 'work', 'predictions'])
    expect(result.meters.tampering).toBe(1)
  })

  it('compares badge edits with matrix edits after the reshuffle', () => {
    const { policy, predictions } = SOLUTIONS.reshuffle
    expect(play('reshuffle', policy, predictions).edits).toEqual({ badgeEdits: 6, matrixEdits: 10 })
  })

  it('counts separation of duties conflicts against least privilege', () => {
    const { policy, predictions } = SOLUTIONS.reshuffle
    const doubleBadge = {
      ...policy,
      assignments: policy.assignments.map((entry) =>
        entry.agent === 'dee' ? { agent: 'dee', roleIds: ['security', 'auditor'] } : entry,
      ),
    }
    const result = play('reshuffle', doubleBadge, predictions)
    expect(result.meters.dutyConflicts).toHaveLength(1)
    expect(result.meters.leaks).toBe(1)
  })

  it('maps scores to stars', () => {
    expect([100, 95, 94, 75, 74, 50, 49, 0].map(starsFor)).toEqual([3, 3, 2, 2, 1, 1, 0, 0])
  })
})
