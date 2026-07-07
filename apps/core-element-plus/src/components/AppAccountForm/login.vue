<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

defineOptions({
  name: 'LoginForm',
})

const props = defineProps<{
  account?: string
}>()

const emits = defineEmits<{
  onLogin: [account?: string]
  onRegister: [account?: string]
  onResetPassword: [account?: string]
}>()

const appAccountStore = useAppAccountStore()

const title = import.meta.env.VITE_APP_TITLE
const loading = ref(false)

interface LoginModel {
  account: string
  password: string
  remember: boolean
}

const model = ref<LoginModel>({
  account: props.account ?? localStorage.getItem('login_account') ?? '',
  password: '',
  remember: localStorage.getItem('login_account') !== null,
})

const validationSchema = toTypedSchema(z.object({
  account: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
  remember: z.boolean(),
}))

function onSubmit(values: LoginModel) {
  loading.value = true
  appAccountStore.login(values).then(() => {
    if (values.remember) {
      localStorage.setItem('login_account', values.account)
    }
    else {
      localStorage.removeItem('login_account')
    }
    emits('onLogin', values.account)
  }).finally(() => {
    loading.value = false
  })
}
</script>

<template>
  <div class="p-12 flex-col-stretch-center min-h-500px w-full">
    <div class="mb-6 space-y-2">
      <h3 class="text-4xl font-bold">
        欢迎使用 👋🏻
      </h3>
      <p class="text-sm text-muted-foreground lg:text-base">
        {{ title }}
      </p>
    </div>
    <FaForm
      :model="model"
      :validation-schema="validationSchema"
      @submit="onSubmit"
    >
      <FaFormItem name="account">
        <FaInput type="text" placeholder="用户名" class="w-full">
          <template #start>
            <FaIcon name="i-lucide:user" />
          </template>
        </FaInput>
      </FaFormItem>
      <FaFormItem name="password">
        <FaInput type="password" placeholder="密码" class="w-full">
          <template #start>
            <FaIcon name="i-lucide:lock" />
          </template>
        </FaInput>
      </FaFormItem>
      <div class="flex-start-between">
        <FaFormItem name="remember" class="min-w-0">
          <FaCheckbox>
            记住我
          </FaCheckbox>
        </FaFormItem>
        <FaButton variant="link" class="p-0 h-auto" type="button" @click="emits('onResetPassword', model.account)">
          忘记密码了?
        </FaButton>
      </div>
      <FaButton :loading="loading" size="lg" class="w-full" type="submit">
        登录
      </FaButton>
      <div class="text-sm mt-4 flex-center gap-2">
        <span class="text-secondary-foreground op-50">还没有帐号?</span>
        <FaButton variant="link" class="p-0 h-auto" type="button" @click="emits('onRegister', model.account)">
          注册新帐号
        </FaButton>
      </div>
    </FaForm>
  </div>
</template>
