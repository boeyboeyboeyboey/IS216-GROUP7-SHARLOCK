import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineGameCatalog, gameCatalog } from '../data/gameCatalog.js'
import GameInfoCard from '../components/town/GameInfoCard.vue'
import TownAudio from '../components/town/TownAudio.vue'

afterEach(() => vi.restoreAllMocks())

describe('town registration contract', () => {
  it('registers the six planned features with distinct buildings and honest readiness', () => {
    expect(gameCatalog.map((game) => game.id).sort()).toEqual([
      'cli-cyber-defender',
      'phishing-post-mortem',
      'regex-defender',
      'social-engineering-simulator',
      'sql-injection-arcade',
      'threat-briefing',
    ])
    expect(new Set(gameCatalog.map((game) => game.building.type)).size).toBe(6)
    expect(gameCatalog.filter((game) => !game.isPreview).map((game) => game.id)).toEqual([
      'threat-briefing',
    ])
    expect(
      gameCatalog.find((game) => game.id === 'social-engineering-simulator').building.type,
    ).toBe('office')
    for (const [index, game] of gameCatalog.entries()) {
      for (const other of gameCatalog.slice(index + 1)) {
        expect(
          Math.abs(game.building.x - other.building.x) >= 192 ||
            Math.abs(game.building.y - other.building.y) >= 200,
        ).toBe(true)
      }
    }
  })
  it.each([
    [{ difficulty: 0 }, 'integer from 1 to 3'],
    [{ difficulty: 4 }, 'integer from 1 to 3'],
    [{ difficulty: 1.5 }, 'integer from 1 to 3'],
    [{ backgroundKnowledge: [] }, 'background knowledge'],
    [{ backgroundKnowledge: [''] }, 'background knowledge'],
    [{ building: { type: 'office', x: 1000, y: 40 } }, 'inside the town'],
    [{ building: { type: 'castle', x: 0, y: 0 } }, 'supported pixel building'],
    [{ route: 'https://example.com/game' }, 'local /games/ route'],
  ])('rejects unusable building metadata: %j', (changes, error) => {
    expect(() => defineGameCatalog([{ ...gameCatalog[0], ...changes }])).toThrow(error)
  })
  it('rejects duplicate IDs that would hide or select the wrong building', () => {
    expect(() => defineGameCatalog([gameCatalog[0], gameCatalog[0]])).toThrow('unique')
  })
  it('shows all required metadata and an accessible 1–3 star rating', () => {
    for (const game of gameCatalog) {
      const wrapper = mount(GameInfoCard, {
        props: { game },
        global: {
          stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
        },
      })
      expect(wrapper.get('h2').text()).toBe(game.name)
      expect(wrapper.text()).toContain(game.description)
      for (const concept of game.backgroundKnowledge) expect(wrapper.text()).toContain(concept)
      expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe(
        `Difficulty: ${game.difficulty} out of 3 stars`,
      )
      expect(wrapper.findAll('.difficulty-stars .pixel-icon:not(.star-empty)')).toHaveLength(
        game.difficulty,
      )
      expect(wrapper.get('a').attributes('href')).toBe(game.route)
      if (game.isPreview)
        expect(wrapper.text()).toContain(
          game.activation === 'direct'
            ? 'News connection verification pending'
            : 'Playable game in development',
        )
      wrapper.unmount()
    }
  })
})

describe('town audio', () => {
  it('starts muted, plays only on request, pauses on mute, and stops on departure', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = mount(TownAudio)
    const audio = wrapper.get('audio').element
    expect(audio.getAttribute('src')).toBe('/audio/sharlock-bgm.mp3')
    expect(audio.muted).toBe(true)
    expect(audio.loop).toBe(true)
    expect(audio.autoplay).toBe(false)
    expect(play).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(1)
    expect(audio.muted).toBe(false)
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(audio.muted).toBe(true)
    expect(pause).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(pause).toHaveBeenCalledTimes(2)
  })
  it('suspends for the newspaper and only resumes a previously enabled soundtrack', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = mount(TownAudio)
    const audio = wrapper.get('audio').element
    await wrapper.setProps({ suspended: true })
    await wrapper.setProps({ suspended: false })
    expect(play).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.setProps({ suspended: true })
    expect(audio.muted).toBe(true)
    expect(wrapper.get('button').element.disabled).toBe(true)
    await wrapper.setProps({ suspended: false })
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(2)
    expect(audio.muted).toBe(false)
    wrapper.unmount()
  })
  it('reports rejected playback and lets the user retry', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = mount(TownAudio)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('audio').element.muted).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain('Tap to try again')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
  it('ignores pending playback completion after leaving the town', async () => {
    let resolvePlay
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(
      new Promise((resolve) => {
        resolvePlay = resolve
      }),
    )
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = mount(TownAudio)
    const audio = wrapper.get('audio').element
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').element.disabled).toBe(true)
    wrapper.unmount()
    resolvePlay()
    await flushPromises()
    expect(audio.muted).toBe(true)
    expect(pause).toHaveBeenCalledTimes(1)
  })
})
