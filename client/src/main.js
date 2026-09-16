import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/styles/main.css'
import './assets/styles/town.css'
import App from './App.vue'
import router from './router/index.js'

createApp(App).use(createPinia()).use(router).mount('#app')
