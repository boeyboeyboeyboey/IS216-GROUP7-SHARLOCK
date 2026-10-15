import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/styles/main.css'
import './assets/styles/town.css'
import App from './App.vue'
import router from './router/index.js'
import { api } from './services/api.js'
import { useAuthStore } from './features/auth/store.js'
import { createAccountGuard, installBrowserAccountAccess } from './features/auth/guards.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const auth = useAuthStore(pinia)
router.beforeEach(createAccountGuard(auth))
const removeAccountAccess = installBrowserAccountAccess(api, {
  checkSession: () => auth.restoreSession({ force: true }),
  onExpired: () => {
    auth.invalidateSession()
    if (router.currentRoute.value.meta.requiresAccount) {
      void router.replace({ path: '/login', query: { reason: 'expired' } }).catch(() => {})
    }
  },
})
if (window.location.pathname !== '/activate-account') {
  void auth.restoreSession().catch(() => {})
}
app.use(router).mount('#app')
if (import.meta.hot) import.meta.hot.dispose(removeAccountAccess)
