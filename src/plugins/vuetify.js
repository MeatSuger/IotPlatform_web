// src/plugins/vuetify.js
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { md3 } from 'vuetify/blueprints'

export default createVuetify({
        blueprint: md3, // 使用 Material Design 3
        theme: {
                defaultTheme: 'myCustomTheme',
                themes: {
                        myCustomTheme: {
                                dark: false,
                                colors: {
                                        primary: '#1976D2',    // 主色
                                        secondary: '#424242',  // 次色
                                        accent: '#82B1FF',     // 强调色
                                        error: '#FF5252',      // 错误色
                                        info: '#2196F3',       // 信息色
                                        success: '#4CAF50',    // 成功色
                                        warning: '#FB8C00',    // 警告色
                                        background: '#F5F5F5', // 页面背景
                                        surface: '#FFFFFF',    // 卡片背景
                                }
                        }
                }
        }
})
