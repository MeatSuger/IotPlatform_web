import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/components/Login.vue';
import ResingerPage from '@/components/Resinger.vue';
import LoginPage from '@/views/LoginPage.vue';
import MainPage from '@/views/MainPage.vue';
import Dashboard from '@/components/Dashboard.vue'
import DeviceInfo from '@/components/Device/DeviceInfo.vue';
import Monitor from '@/components/Analysis/Analysis.vue';
import AddDevice from '@/components/Device/AddDevice.vue';


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
        {
          path: 'deviceManagement', children: [
            { name: 'deviceInfo', path: 'deviceInfo', component: DeviceInfo },
            { name: 'addDevice', path: 'addDevice', component: AddDevice },
            // Additional device management routes can be added here
          ]
        },
        {
          path: '/monitor', children: [{
            name: 'monitor', path: 'monitor', component: Monitor,
          }
          ]
        },
        // {name: 'userProfile', path: 'userProfile', component: () => import('@/components/UserProfile.vue')
      ]
    }
  ],
})

export default router
