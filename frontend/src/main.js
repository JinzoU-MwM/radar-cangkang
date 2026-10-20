import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { init } from './store.js'
import './tokens.css'

createApp(App).use(router).mount('#app')
init()
