<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import { toTypedSchema } from '@vee-validate/zod'
import { ref } from 'vue'
import * as z from 'zod'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({
  name: 'EditDevice',
})

const router = useRouter()
const route = useRoute()

const formRef = useTemplateRef<FormExpose>('formRef')
const loading = ref(false)
const pageLoading = ref(true)
const deviceId = ref(String(route.query.deviceId ?? ''))

const model = ref({
  deviceName: '',
  deviceType: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
  location: '',
})

const validationSchema = toTypedSchema(z.object({
  deviceName: z.string().min(1, '请输入设备名称').max(100, '名称最多 100 字符'),
  deviceType: z.string().min(1, '请选择设备类型'),
  firmwareVersion: z.string().max(50, '固件版本最多 50 字符'),
  ipAddress: z.string().max(45, 'IP 地址过长'),
  macAddress: z.string().max(17, 'MAC 地址过长'),
  location: z.string().max(255, '位置最多 255 字符'),
}))

const deviceTypeOptions = [
  { label: '温度(°C)', value: 'temperature' },
  { label: '湿度(%RH)', value: 'humidity' },
  { label: '网关', value: 'gateway' },
  { label: '环境监测', value: 'environment' },
  { label: 'ESP32', value: 'ESP32' },
]

async function fetchDevice() {
  if (!deviceId.value) {
    useFaToast().error('缺少设备 ID')
    handleCancel()
    return
  }
  pageLoading.value = true
  try {
    const res: any = await deviceApi.getDetail(deviceId.value)
    const data = res?.data?.data ?? res?.data
    model.value = {
      deviceName: data.deviceName || '',
      deviceType: data.deviceType || '',
      firmwareVersion: data.firmwareVersion || '',
      ipAddress: data.ipAddress || '',
      macAddress: data.macAddress || '',
      location: data.location || '',
    }
  }
  catch (error) {
    console.error('[EditDevice] load failed:', error)
    useFaToast().error('加载设备失败', { description: '请返回后重试' })
    handleCancel()
  }
  finally {
    pageLoading.value = false
  }
}

async function onSubmit(values: typeof model.value) {
  if (!deviceId.value) {
    return
  }
  loading.value = true
  try {
    // 后端为增量语义：这里显式传全量可编辑字段
    const res: any = await deviceApi.update(deviceId.value, values)
    if (res?.code === 200 || res?.data != null) {
      useFaToast().success('设备更新成功')
      handleCancel()
    }
    else {
      useFaToast().error('更新失败', { description: res?.message || '请稍后重试' })
    }
  }
  catch (error: any) {
    console.error('[EditDevice] submit error:', error)
    useFaToast().error('更新失败', { description: error?.data?.message || error?.message || '请稍后重试' })
  }
  finally {
    loading.value = false
  }
}

async function submit() {
  await formRef.value?.submit()
}

function handleCancel() {
  router.back()
}

fetchDevice()
</script>

<template>
  <div>
    <FaPageHeader title="编辑设备">
      <template #description>
        <span class="text-sm text-gray-500">设备 ID：{{ deviceId }}</span>
      </template>
    </FaPageHeader>
    <FaPageMain>
      <div v-loading="pageLoading" class="mx-auto max-w-600px">
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
      <FaButton type="submit" :loading="loading" @click="submit">
        提交
      </FaButton>
    </FaFixedBar>
  </div>
</template>
