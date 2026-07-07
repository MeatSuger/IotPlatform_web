<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({ name: 'AddDevice' })

interface RuleForm {
  deviceName: string
  deviceType: string
  firmwareVersion: string
  ipAddress: string
  macAddress: string
}

const formRef = ref<FormInstance>()
const loading = ref(false)

const ruleForm = reactive<RuleForm>({
  deviceName: '',
  deviceType: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
})

const rules = reactive<FormRules<RuleForm>>({
  deviceName: [{ required: true, message: '设备名称不能为空', trigger: 'blur' }],
  deviceType: [{ required: true, message: '请选择设备类型', trigger: 'change' }],
})

async function onSubmit() {
  if (!formRef.value) {
    return
  }
  try {
    await formRef.value.validate()
  }
  catch {
    return
  }

  loading.value = true
  try {
    const res = await deviceApi.register(ruleForm)
    if (res.data?.code === 200) {
      useFaToast().success('设备添加成功')
      onReset()
    }
    else {
      useFaToast().error('添加失败', { description: res.data?.message || '添加设备失败' })
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
</script>

<template>
  <FaPageMain>
    <el-card shadow="always" :body-style="{ padding: '20px' }">
      <template #header>
        <div>
          <span>添加设备</span>
        </div>
      </template>
      <el-row>
        <el-col :span="12">
          <el-form
            ref="formRef"
            :model="ruleForm"
            :rules="rules"
            label-width="120px"
            size="large"
            @submit.prevent="onSubmit"
          >
            <el-form-item label="设备名称" prop="deviceName">
              <el-input v-model="ruleForm.deviceName" />
            </el-form-item>
            <el-form-item label="设备类型" prop="deviceType">
              <el-select v-model="ruleForm.deviceType" placeholder="请选择设备类型">
                <el-option label="温度(°C)" value="temperature" />
                <el-option label="湿度(%RH)" value="humidity" />
              </el-select>
            </el-form-item>
            <el-form-item label="固件版本">
              <el-input v-model="ruleForm.firmwareVersion" />
            </el-form-item>
            <el-form-item label="IP 地址">
              <el-input v-model="ruleForm.ipAddress" />
            </el-form-item>
            <el-form-item label="MAC 地址">
              <el-input v-model="ruleForm.macAddress" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" native-type="submit" :loading="loading">
                立即创建
              </el-button>
              <el-button @click="onReset">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
    </el-card>
  </FaPageMain>
</template>
