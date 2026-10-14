import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Profile from '../views/Profile.vue'
import ComingSoon from '../views/ComingSoon.vue'

export const routes = [
  {
    path: '/',
    name: 'town',
    component: Dashboard,
    meta: { title: 'Sharlock Town', theme: 'town', requiresAccount: true },
    children: [
      {
        path: '/games/threat-briefing',
        name: 'news',
        component: () => import('../games/threat-briefing/NewsDialog.vue'),
        meta: { title: 'The Sharlock Times', newsDialog: true },
      },
    ],
  },
  { path: '/dashboard', redirect: (to) => ({ path: '/', query: to.query, hash: to.hash }) },
  {
    path: '/profile',
    component: Profile,
    meta: { title: 'Detective profile', accountAware: true },
  },
  {
    path: '/progress',
    component: Profile,
    meta: { title: 'Learning progress', accountAware: true },
  },
  {
    path: '/login',
    component: () => import('../features/auth/pages/LoginPage.vue'),
    meta: { title: 'Sign in', authPage: true },
  },
  {
    path: '/register',
    component: () => import('../features/auth/pages/RegisterPage.vue'),
    meta: { title: 'Create account', authPage: true },
  },
  ...[
    ['integrity-detective', 'cli-cyber-defender'],
    ['mini-ctf', 'sql-injection-arcade'],
    ['access-control', 'social-engineering-simulator'],
    ['red-blue', 'regex-defender'],
  ].map(([previous, current]) => ({
    path: `/games/${previous}`,
    redirect: `/games/${current}`,
  })),
  {
    path: '/games/phishing-post-mortem',
    component: () => import('../games/phishing-post-mortem/PhishingPostMortem.vue'),
    meta: { title: 'The Phishing Post-Mortem', requiresAccount: true },
  },
  {
    path: '/games/social-engineering-simulator',
    component: () => import('../games/social-engineering-simulator/SocialEngineeringSimulator.vue'),
    meta: { title: 'LLM Social Engineering Simulator', requiresAccount: true },
  },
  {
    path: '/games/cli-cyber-defender',
    component: () => import('../games/cli-cyber-defender/CliDefenderGame.vue'),
    meta: { title: 'CLI Cyber Defender', requiresAccount: true },
  },
  {
    path: '/games/:gameId',
    component: () => import('../views/GamePreview.vue'),
    meta: { title: 'Case preview', requiresAccount: true },
  },
  {
    path: '/about',
    component: () => import('../views/About.vue'),
    meta: { title: 'About Sharlock' },
  },
  ...[
    [
      'leaderboard',
      'A little friendly competition',
      'Cohort rankings will celebrate your learning alongside your classmates.',
    ],
    [
      'instructor',
      'A view of every little breakthrough',
      'The instructor workspace will show progress within assigned cohorts.',
    ],
    [
      'admin',
      'Behind the detective desk',
      'Account and cohort administration will be available to authorized administrators.',
    ],
    ['forbidden', 'This case needs permission', 'Return to town to find an available activity.'],
  ].map(([path, title, description]) => ({
    path: `/${path}`,
    component: ComingSoon,
    props: { title, description, showMascot: ['login', 'register'].includes(path) },
    meta: { title, ...(path === 'admin' ? { theme: 'utility' } : {}) },
  })),
  {
    path: '/:pathMatch(.*)*',
    component: () => import('../views/NotFound.vue'),
    meta: { title: 'Page not found' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, savedPosition) =>
    to.meta.theme === 'town' && from.meta.theme === 'town' ? false : savedPosition || { top: 0 },
})
router.afterEach((to) => {
  document.title = `${to.meta.title || 'Explore'} · Sharlock`
})
export default router
