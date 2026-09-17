<script setup>
defineOptions({ name: 'SharlockLanding' })
import PixelIcon from '../components/town/PixelIcon.vue'
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
          The internet has<br />its mysteries.<br /><span class="pixel-underline"
            >Let's solve them.</span
          >
        </h1>
        <p>
          Meet Sharlock, your curious capybara companion. Turn cybersecurity fundamentals into
          little adventures worth figuring out.
        </p>
        <RouterLink to="/dashboard" class="btn btn-primary"
          >Explore the town <PixelIcon name="arrow" :size="20" aria-hidden="true" /></RouterLink
        ><span class="landing-preview-note">Try the portal preview · no account needed</span>
      </div>
      <div class="hero-art">
        <span class="art-label art-label-top"
          ><PixelIcon name="shield" :size="20" aria-hidden="true" /> Trust your curiosity.</span
        ><img
          src="/images/town/capybara-mint.svg"
          class="mascot-image hero-mascot"
          width="320"
          height="240"
          alt="Sharlock, a friendly pixel-art capybara wearing a mint scarf"
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
        <PixelIcon name="map" :size="29" aria-hidden="true" />
        <h3>Find your own “aha!”</h3>
        <p>Follow a friendly trail through the fundamentals.</p>
      </div>
      <div>
        <PixelIcon name="shield" :size="29" aria-hidden="true" />
        <h3>Put ideas into practice</h3>
        <p>Make decisions in short, controlled exercises.</p>
      </div>
      <div>
        <PixelIcon name="trophy" :size="29" aria-hidden="true" />
        <h3>Celebrate the little wins</h3>
        <p>Watch your skills grow, one completed case at a time.</p>
      </div>
    </div>
  </div>
</template>
