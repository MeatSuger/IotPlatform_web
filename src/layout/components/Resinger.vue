<template>
  <div class="login-wrap">
    <h2 class="title">注册账号</h2>
    <form @submit.prevent="onSubmit" novalidate>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
        <el-container direction="vertical">
          <el-form-item prop="account">
            <el-input
              v-model="form.account"
              type="text"
              placeholder="用户名"
              clearable
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item prop="passwd">
            <el-input
              v-model="form.passwd"
              type="password"
              placeholder="密码"
              clearable
              show-password
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item prop="authpasswd">
            <el-input
              v-model="form.authpasswd"
              type="password"
              placeholder="确认密码"
              clearable
              show-password
              autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              style="width: 100%"
              native-type="submit"
              @click="onSubmit"
              >注册</el-button
            >
          </el-form-item>
          <div class="links">
            <RouterLink to="/auth/login">
              <el-link type="primary" underline="hover">返回登录</el-link>
            </RouterLink>
          </div>
        </el-container>
      </el-form>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { resinger as registerApi, resinger } from '@/services/auth'

const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  account: '',
  passwd: '',
  authpasswd: '',
})

const rules = ref<FormRules<typeof form>>({
  account: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
  passwd: [{ required: true, message: '密码不能为空', trigger: 'blur' }],
  authpasswd: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.passwd) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
})

const onSubmit = () => {
  console.log('提交注册表单')
  if (!formRef.value) return
  formRef.value.validate(async (valid) => {
    if (!valid) return
    if (form.passwd !== form.authpasswd) {
      ElMessage.error('两次输入的密码不一致')
      return
    }
    loading.value = true

    resinger(form.account, form.passwd)
      .then(() => {
        ElMessage.success('注册成功')
        router.push('/auth/login')
      })
      .catch((err) => {
        console.error('注册失败', err)
        ElMessage.error(err.response?.data?.message || '注册失败')
      })
      .finally(() => {
        loading.value = false
      })
  })
}
</script>
<style scoped>
.login-button {
  border-radius: 1rem;
}

.title {
  font-size: 1.8rem;
  text-align: center;
  margin-bottom: 1.5rem;
  margin-top: 1.5rem;
  color: #333;
}

.links {
  display: flex;
  justify-content: flex-end;
  /* 右对齐返回登录 */
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.login-wrap {
  width: 100%;
  max-width: 560px;
  /* 放大容器宽度（原400px）*/
  margin: 0 auto;
  padding: 24px;
  /* 更舒展的内边距 */
  box-sizing: border-box;
}
</style>
