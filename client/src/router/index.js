import { createRouter, createWebHistory } from 'vue-router'
import Landing from '../views/Landing.vue'
import Dashboard from '../views/Dashboard.vue'
import Profile from '../views/Profile.vue'
import ComingSoon from '../views/ComingSoon.vue'

export const routes = [
  { path: '/', component: Landing, meta: { title: 'Meet Sharlock' } },
  { path: '/dashboard', component: Dashboard, meta: { title: 'Sharlock Town', theme: 'town' } },
  { path: '/profile', component: Profile, meta: { title: 'Detective profile' } },
  { path: '/progress', component: Profile, meta: { title: 'Learning progress' } },
  {
    path: '/games/:gameId',
    component: () => import('../views/GamePreview.vue'),
    meta: { title: 'Case preview' },
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
      'login',
      'Your next chapter starts here',
      'Sign-in will keep your discoveries and achievements together.',
    ],
    [
      'register',
      'Join the investigation',
      'Student registration is coming soon. You can explore the town preview now.',
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
    meta: { title },
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
  scrollBehavior: (_to, _from, savedPosition) => savedPosition || { top: 0 },
})
router.afterEach((to) => {
  document.title = `${to.meta.title || 'Explore'} · Sharlock`
})
export default router
