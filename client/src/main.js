import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/styles/main.css'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
