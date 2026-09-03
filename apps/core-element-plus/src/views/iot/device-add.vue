<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import { toTypedSchema } from '@vee-validate/zod'
import { ref } from 'vue'
import * as z from 'zod'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({
  name: 'AddDevice',
})

const router = useRouter()

const formRef = useTemplateRef<FormExpose>('formRef')
const loading = ref(false)

const model = ref({
  deviceName: '',
  deviceType: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
  location: '',
})

const validationSchema = toTypedSchema(z.object({
  deviceName: z.string().min(1, '请输入设备名称'),
  deviceType: z.string().min(1, '请选择设备类型'),
  firmwareVersion: z.string(),
  ipAddress: z.string(),
  macAddress: z.string(),
  location: z.string(),
}))

const deviceTypeOptions = [
  { label: '温度(°C)', value: 'temperature' },
  { label: '湿度(%RH)', value: 'humidity' },
]

async function onSubmit(values: typeof model.value) {
  loading.value = true
  try {
    // axios 拦截器已解包一层，res 即响应体 { code, message, data }
    const res: any = await deviceApi.register(values)
    if (res.code === 200) {
      useFaToast().success('设备添加成功')
      onReset()
    }
    else {
      useFaToast().error('添加失败', { description: res.message || '添加设备失败' })
    }
  }
  catch (error: any) {
    console.error('[AddDevice] submit error:', error)
    useFaToast().error('添加失败', { description: error?.response?.data?.message || '添加设备失败' })
  }
  finally {
    loading.value = false
  }
}

function onReset() {
  formRef.value?.resetFields()
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <div>
    <FaPageHeader title="添加设备" />
    <FaPageMain>
      <div v-loading="loading" class="mx-auto max-w-600px">
        <FaForm
          ref="formRef"
          :model="model"
          :validation-schema="validationSchema"
          class="gap-6 grid"
          @submit="onSubmit"
        >
          <FaFormItem name="deviceName" label="设备名称" required>
            <FaInput placeholder="请输入设备名称" class="w-full" />
          </FaFormItem>
          <FaFormItem name="deviceType" label="设备类型" required>
            <FaSelect :options="deviceTypeOptions" placeholder="请选择设备类型" class="w-full" />
          </FaFormItem>
          <FaFormItem name="firmwareVersion" label="固件版本">
            <FaInput placeholder="请输入固件版本" class="w-full" />
          </FaFormItem>
          <FaFormItem name="ipAddress" label="IP 地址">
            <FaInput placeholder="请输入 IP 地址" class="w-full" />
          </FaFormItem>
          <FaFormItem name="macAddress" label="MAC 地址">
            <FaInput placeholder="请输入 MAC 地址" class="w-full" />
          </FaFormItem>
          <FaFormItem name="location" label="位置">
            <FaInput placeholder="请输入设备位置（可选）" class="w-full" />
          </FaFormItem>
        </FaForm>
      </div>
    </FaPageMain>
    <FaFixedBar position="bottom" class="flex gap-2 justify-center">
      <FaButton type="button" variant="outline" @click="handleCancel">
        取消
      </FaButton>
      <FaButton type="button" :loading="loading" @click="onReset">
        重置
      </FaButton>
      <FaButton type="submit" :loading="loading" @click="formRef?.submit()">
        提交
      </FaButton>
    </FaFixedBar>
  </div>
</template>
