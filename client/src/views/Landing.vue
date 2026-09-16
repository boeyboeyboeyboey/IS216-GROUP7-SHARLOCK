<script setup>
defineOptions({ name: 'SharlockLanding' })
import { PhArrowRight, PhFingerprint, PhPath, PhMedal } from '@phosphor-icons/vue'
import SharlockTip from '../components/portal/SharlockTip.vue'
</script>
<template>
  <div class="landing-view">
    <p class="eyebrow landing-eyebrow">
      <span class="tiny-dot"></span> BIG CURIOSITY. SMALL ADVENTURES.
    </p>
    <section class="landing-hero">
      <div class="landing-copy">
        <h1 tabindex="-1">
          The internet has<br />its mysteries.<br /><span class="mint-underline"
            >Let's solve them.</span
          >
        </h1>
        <p>
          Meet Sharlock, your curious capybara companion. Turn cybersecurity fundamentals into
          little adventures worth figuring out.
        </p>
        <RouterLink to="/dashboard" class="btn btn-primary"
          >Explore the town <PhArrowRight :size="20" aria-hidden="true" /></RouterLink
        ><span class="landing-preview-note">Try the portal preview · no account needed</span>
      </div>
      <div class="hero-art">
        <span class="art-label art-label-top"
          ><PhFingerprint :size="20" weight="duotone" aria-hidden="true" /> Trust your
          curiosity.</span
        ><img
          src="/images/sharlock-placeholder.svg"
          class="mascot-image hero-mascot"
          width="360"
          height="340"
          alt="Sharlock mascot placeholder: a friendly, softly rounded 3D-style capybara wearing a sleuthing monocle and mint detective waistcoat, smiling and ready to investigate"
        /><span class="art-label art-label-bottom">Your trusty sidekick, Sharlock.</span>
      </div>
    </section>
    <section class="landing-intro" aria-labelledby="learning-heading">
      <div>
        <p class="eyebrow">LEARN BY FIGURING IT OUT</p>
        <h2 id="learning-heading">Less memorising.<br />More investigating.</h2>
      </div>
      <p>
        Decode a clue, question a message, or decide who gets access. Each small case helps you
        understand the decisions that keep our digital world safer.
      </p>
      <SharlockTip
        text="A good detective pauses, checks the evidence, and asks why. Those are cybersecurity skills, too."
      />
    </section>
    <div class="landing-benefits">
      <div>
        <PhPath :size="29" weight="duotone" aria-hidden="true" />
        <h3>Find your own “aha!”</h3>
        <p>Follow a friendly trail through the fundamentals.</p>
      </div>
      <div>
        <PhFingerprint :size="29" weight="duotone" aria-hidden="true" />
        <h3>Put ideas into practice</h3>
        <p>Make decisions in short, controlled exercises.</p>
      </div>
      <div>
        <PhMedal :size="29" weight="duotone" aria-hidden="true" />
        <h3>Celebrate the little wins</h3>
        <p>Watch your skills grow, one completed case at a time.</p>
      </div>
    </div>
  </div>
</template>
