<script setup>
import { owaspEdition, owaspRisks } from '../data/owaspTopTen.js'
import PixelIcon from '../../../components/town/PixelIcon.vue'
</script>
<template>
  <div class="gazette-edition owasp-edition">
    <div class="gazette-edition-line">
      <span>THE SECURITY FIELD GUIDE</span><span>OWASP · {{ owaspEdition.year }} EDITION</span>
      <span>KEEP YOUR CURIOSITY SHARP</span>
    </div>
    <header class="owasp-intro">
      <p class="gazette-kicker"><PixelIcon name="shield" :size="20" /> NOTES FROM THE NEWS DESK</p>
      <h2>Ten risks worth recognising</h2>
      <p>
        OWASP’s Top 10 highlights major web application security risks. These are broad risk
        categories, not ten individual bugs or a complete security checklist.
      </p>
      <p>
        Open a field note for a plain-language explanation, a fictional town example and a defence.
      </p>
    </header>
    <ol class="owasp-risks" aria-label="OWASP Top 10 2025 risks">
      <li v-for="(risk, index) in owaspRisks" :key="risk.id">
        <details :open="index === 0">
          <summary>
            <span class="owasp-number">{{ risk.id }}</span>
            <h3>{{ risk.title }}</h3>
          </summary>
          <div class="owasp-note">
            <p>{{ risk.summary }}</p>
            <dl>
              <dt>A fictional town example</dt>
              <dd>{{ risk.example }}</dd>
              <dt>A stronger defence</dt>
              <dd>{{ risk.prevention }}</dd>
            </dl>
            <a
              :href="`${owaspEdition.source}${risk.source}/`"
              target="_blank"
              rel="noopener noreferrer"
              class="gazette-read"
            >
              Read {{ risk.id }} at OWASP ↗<span class="visually-hidden">
                (opens in a new tab)</span
              >
            </a>
          </div>
        </details>
      </li>
    </ol>
    <footer class="gazette-footer">
      <p>
        Adapted and simplified from the
        <a :href="owaspEdition.source" target="_blank" rel="noopener noreferrer"
          >OWASP Top 10:2025<span class="visually-hidden"> (opens in a new tab)</span></a
        >
        by the OWASP Top 10 Team, under
        <a :href="owaspEdition.license" target="_blank" rel="noopener noreferrer"
          >CC BY 3.0<span class="visually-hidden"> (opens in a new tab)</span></a
        >. Town examples are original fictional illustrations. Reference checked
        {{ owaspEdition.reviewedAt }}.
      </p>
      <span>REFERENCE EDITION · AVAILABLE WITHOUT A NEWS CONNECTION</span>
    </footer>
  </div>
</template>
