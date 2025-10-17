import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/components/Login.vue';
import ResingerPage from '@/components/Resinger.vue';



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{
    path: '/login',
    component: Login,
  }, {
    path: '/resinger',
    component: ResingerPage,
  }, {
    path: '/',
    component: Login,
  }],
})

export default router
