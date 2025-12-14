<template>
  <div style="background-color: aquamarine">
    <el-card shadow="always" :body-style="{ padding: '20px' }">
      <template #header>
        <div>
          <span>添加设备</span>
        </div>
      </template>
      <el-row>
        <el-col :span="12">
          <el-form
            :model="ruleForm"
            :rules="rules"
            label-width="100px"
            @submit.prevent="onSubmit"
            size="large"
          >
            <el-form-item label="deviceName" prop="deviceName">
              <el-input v-model="ruleForm.deviceName" />
            </el-form-item>
            <el-form-item label="deviceType" prop="deviceType">
              <el-select v-model="ruleForm.deviceType" placeholder="please select your zone">
                <el-option label="温度(°C)" value="temptaure" />
                <el-option label="湿度(%RH)" value="humidy" />
              </el-select>
            </el-form-item>
            <el-form-item label="firmwareVersion">
              <el-input v-model="ruleForm.firmwareVersion" />
            </el-form-item>
            <el-form-item label="ipAddress">
              <el-input v-model="ruleForm.ipAddress" />
            </el-form-item>
            <el-form-item label="macAddress">
              <el-input v-model="ruleForm.macAddress" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" native-type="submit">立即创建</el-button>
              <el-button>取消</el-button>
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="12"> 占位符 </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import request from '@/utils/request'
import { type FormRules } from 'element-plus'
import { reactive } from 'vue'

interface RuleForm {
  deviceName: string
  deviceType: string
  firmwareVersion: string
  ipAddress: string
  macAddress: string
}

const ruleForm = reactive<RuleForm>({
  deviceName: '',
  deviceType: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
})

const devices_type = ['temptaure(°C)', 'humidy(%RH)']

const rules = reactive<FormRules<RuleForm>>({
  deviceName: [{ required: true, message: 'Device Name is required', trigger: 'blur' }],
  deviceType: [{ required: true, message: 'Device Type is required', trigger: 'change' }],
})

const onSubmit = () => {
  try {
    request
      .post('/device/register', ruleForm)
      .then((data) => {
        if (data.data.code === 400) {
          ElMessage.error(data.data.message || 'Failed to add device')
        } else if (data.data.code === 200) {
          ElMessage.success('Device added successfully')
        }
      })
      .catch((error) => {
        console.error('Error adding device:', error)
        ElMessage.error(error.response?.data?.message || 'Failed to add device')
      })
  } catch (error) {
    console.error('Unexpected error:', error)
    ElMessage.error('An unexpected error occurred')
  }
}
</script>

<style scoped></style>
