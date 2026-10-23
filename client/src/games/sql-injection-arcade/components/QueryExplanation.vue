<script setup>
import { computed } from 'vue'
const props = defineProps({
  evaluation: { type: String, default: '' },
  mode: { type: String, default: 'unsafe' },
})
const explanations = {
  BYPASS:
    'Bypass found! The quote closes a string, OR introduces a true equality, and -- comments out the remaining checks.',
  FALSE_EQUALITY:
    'The quote breaks out, but the literal equality is false. OR does not automatically make every condition true.',
  NO_BREAKOUT:
    'The input stays data inside the quoted value. The fictional credentials do not match.',
  UNSUPPORTED:
    'This input is outside the teaching grammar. Try quote breakout, OR, equal integer or quoted-string literals, then --. Stacked statements are not supported.',
}
const feedback = computed(
  () =>
    explanations[props.evaluation] ||
    'Follow the input from the form into the query. Where does data become query code?',
)
</script>
<template>
  <section class="sql-explanation" aria-label="Query inspector">
    <div class="sql-monitor-bar">
      <h2>
        <span class="sql-console-name">{{ mode === 'safe' ? 'PATCHED / ' : '01 / ' }}</span
        >Query inspector
      </h2>
      <span class="sql-monitor-indicator"
        ><span aria-hidden="true">■</span>
        {{ mode === 'safe' ? 'PARAMETERS BOUND' : 'SIMULATION' }}</span
      >
    </div>
    <div class="sql-query-content">
      <p class="small">Illustration only · no database query runs</p>
      <pre
        v-if="mode === 'unsafe'"
        aria-label="Illustrative unsafe query"
      ><code><span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> fictional_users
<span class="sql-keyword">WHERE</span> username = '<mark>[username]</mark>'
<span class="sql-keyword">AND</span> password = <span class="sql-literal">'[fictional password]'</span></code></pre>
      <pre
        v-else
        aria-label="Illustrative parameterized query"
      ><code><span class="sql-keyword">SELECT</span> * <span class="sql-keyword">FROM</span> fictional_users
<span class="sql-keyword">WHERE</span> username = <span class="sql-parameter">:username</span>
<span class="sql-keyword">AND</span> password = <span class="sql-parameter">:password</span></code></pre>
      <p v-if="mode === 'safe'">
        In the earlier unsafe query, quote breakout, a true condition and a comment could bypass the
        fictional checks.
      </p>
      <p v-else role="status" aria-live="polite">{{ feedback }}</p>
      <ol v-if="evaluation === 'BYPASS'">
        <li><code>'</code> closes the input string</li>
        <li><code>OR 1=1</code> supplies a true condition</li>
        <li><code>--</code> comments out the suffix</li>
      </ol>
      <p v-if="mode === 'safe'">
        Bound values stay data, including quotes and SQL-looking text. They cannot rewrite the
        prepared query.
      </p>
    </div>
  </section>
</template>
