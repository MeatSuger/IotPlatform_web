import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/components/Login.vue';
import ResingerPage from '@/components/Resinger.vue';
import LoginPage from '@/views/LoginPage.vue';
import MainPage from '@/views/MainPage.vue';
import Dashboard from '@/components/Dashboard.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      component: LoginPage,
      children: [
        { name: 'Login', path: 'login', component: Login },
        { name: 'Resinger', path: 'resinger', component: ResingerPage },
      ]
    },
    {
      path: '/',
      redirect: '/auth/login',
    },
    {
      path: '/mainpage',
      component: MainPage,
      children: [
        { name: 'dashboard', path: 'dashboard', component: Dashboard },
        // {name: 'deviceManagement', path: 'deviceManagement', component: () => import('@/components/DeviceManagement.vue')},
        // {name: 'dataVisualization', path: 'dataVisualization', component: () => import('@/components/DataVisualization.vue')},
        // {name: 'userProfile', path: 'userProfile', component: () => import('@/components/UserProfile.vue')
      ]
    }
  ],
})

export default router
