<template>
  <div class="tags-view">
    <el-scrollbar>
      <div class="tags">
        <el-tag
          v-for="tag in visitedViews"
          :key="tag.path"
          :closable="!tag.affix"
          :effect="tag.path === activePath ? 'dark' : 'plain'"
          size="small"
          @close="closeTag(tag)"
          @click="go(tag.path)"
        >
          {{ tag.title || tag.path }}
        </el-tag>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface VisitedView {
  title: string
  path: string
  affix?: boolean
}

const route = useRoute()
const router = useRouter()
const state = reactive<{ visitedViews: VisitedView[] }>({ visitedViews: [] })

const activePath = computed(() => route.path)

const addTag = (r = route) => {
  if (!r.meta?.title) return
  const exists = state.visitedViews.find((v) => v.path === r.path)
  if (exists) return
  state.visitedViews.push({
    title: String(r.meta.title),
    path: r.path,
    affix: Boolean(r.meta.affix),
  })
}

const initAffix = () => {
  route.matched.forEach((r) => {
    if (r.meta?.affix && r.path) {
      state.visitedViews.push({ title: String(r.meta.title || r.path), path: r.path, affix: true })
    }
  })
}

const closeTag = (tag: VisitedView) => {
  const idx = state.visitedViews.findIndex((v) => v.path === tag.path)
  if (idx === -1) return
  state.visitedViews.splice(idx, 1)
  if (tag.path === route.path) {
    const next = state.visitedViews[idx - 1] || state.visitedViews[idx] || state.visitedViews[0]
    if (next) router.push(next.path)
  }
}

const go = (path: string) => {
  router.push(path)
}

watch(
  () => route.fullPath,
  () => addTag(route),
  { immediate: true },
)

onMounted(() => {
  initAffix()
  addTag(route)
})

onBeforeUnmount(() => {
  state.visitedViews = []
})

const visitedViews = state.visitedViews
</script>

<style scoped>
.tags-view {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  padding: 6px 12px;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}
</style>
