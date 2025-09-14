<script setup lang="ts">
import { onUnmounted, ref, toRaw, watch } from 'vue';
import { ElInput, ElMessage } from 'element-plus';
import { Promotion } from '@element-plus/icons-vue'
import Typed from 'typed.js';
// import hljs from "highlight.js";
import { userStore } from '@/store';
import { useAISession } from '@/hooks/useAISession';
import { useLoadingText } from '@/hooks/useLoadingText';
import { usePrimaryColor } from '@/hooks/usePrimaryColor';
import { fetchSuggestSQLStream } from '@/service/aiEditor';
import { AI_SESSION_PLACEHOLDER, AI_SESSION_OUTPUT_ID ,AI_SESSION_TOOLS } from './constants';
import { IFetchSuggestSQL, ISchemaData } from '@/types/aiEditor';
import deepChatLogo from "@/assets/logo_sm.png";
// import "highlight.js/styles/atom-one-dark.css";
// import "highlight.js/styles/atom-one-light.css";

const { userInfo } = userStore()
const { primaryColor } = usePrimaryColor()
const { currentLoadingText, startLoadingTextAnimation, stopLoadingTextAnimation } = useLoadingText()
const { aiOutputVisible, aiRequestLoading, aiSessionContent, resetAiSessionContent } = useAISession()

const emits = defineEmits(['onEmitCloseAISession', 'onVisualize'])
const props = defineProps(['schemaData', 'MonacoUtils', 'aiSessionStyle', 'activateAiSession'])

const flippingLogo = ref(false)
const outputContentDivRef = ref<HTMLDivElement>()
const AiInputComponentRef = ref<InstanceType<typeof ElInput>>()

let typed: Typed;
let aiOutputContent = ''

onUnmounted(() => {
  if (typed) typed.destroy()
})

const onAISessionInput = (value) => {
  if (value.length === 1 && value === ' ') {
    emits('onEmitCloseAISession')
    resetAiSessionContent()
  }
}

const parseSchemaData = (schemaData: ISchemaData[] = []): {
  datasourceId: string;
  tables?: Array<string>;
  fields?: Array<string>;
} => {
  let datasourceId = ''
  let tables: string[] = []
  let fields: string[] = []
  
  if (schemaData.length) {
    datasourceId = schemaData[0].datasourceId
    schemaData.forEach(schema => {
      if (schema.table) {
        tables.push(schema.table)
        if (schema.fields.length) {
          schema.fields.forEach(field => {
            const f = field.split('_')
            fields.push(`${schema.table}.${f[f.length-1]}`)
          })
        }
      }
    })
  }
  return {
    datasourceId,
    tables: tables.length ? tables : undefined,
    fields: fields.length ? fields : undefined,
  }
}

const handlerTyped = () => {
  if (typed) {
    // @ts-ignore
    typed.strings = [aiOutputContent]
    return typed.reset()
  }
  typed = new Typed(`#${outputContentDivRef.value?.id}`, {
    strings: [aiOutputContent],
    typeSpeed: 50,
    loop: false,
    showCursor: false,
    onComplete: () => {
      flippingLogo.value = false
    }
  });
}

const onSendMeseageToAI = async() => {
  try {
    const {datasourceId, tables, fields} = parseSchemaData(toRaw(props.schemaData))
    const data: IFetchSuggestSQL = {
      datasourceId, tables, fields,
      userId: userInfo.id,
      purpose: aiSessionContent.value,
      sql: props.MonacoUtils.Editor.getValue(),
    }
    if (!userInfo.id) throw 'please check user id';
    if (!data.datasourceId) return ElMessage.warning('DataSource cannot be empty!')
    if (!data.sql && (!tables && !fields)) return ElMessage.warning('SQL cannot be empty!')

    flippingLogo.value     = true
    aiOutputVisible.value  = true
    aiRequestLoading.value = true
    startLoadingTextAnimation()
    aiOutputContent = ''
    await fetchSuggestSQLStream(data, (result) => {
      // console.log(Date.now(), result);
      aiOutputContent += `${result}`
    })
  } catch (error) {
    flippingLogo.value = false
    aiOutputContent = (error as Error).message
    console.error("Stream error:", error);
  } finally {
    handlerTyped()
    aiRequestLoading.value = false
    stopLoadingTextAnimation()
  }
}

const resetOutput = () => {
  aiOutputContent = ''
  aiOutputVisible.value = false
  if (outputContentDivRef.value) {
    outputContentDivRef.value.innerHTML = ''
  }
}

const setEditorValue = (value: string) => {
  props.MonacoUtils.Editor.setValue(value)
  emits('onEmitCloseAISession')
}

const onToolAction = (action: number) => {
  switch (action) {
    case 1: // 覆盖
      setEditorValue(aiOutputContent)
      resetOutput()
      break;
    case 2: // 插入
      const value = `${props.MonacoUtils.Editor.getValue()}\n${aiOutputContent}`
      setEditorValue(value)
      resetOutput()
      break;
    case 3: // 拒绝
      resetOutput()
      break;
    case 4: // 再试一次
      onSendMeseageToAI()
      break;
  }
}

watch(() => props.activateAiSession, value => {
  if (!value) { }
})

defineExpose({ focus: () => AiInputComponentRef.value?.focus() })
</script>

<template>
  <div class="ai-session" v-show="props.activateAiSession" :style="{...props.aiSessionStyle}">
    <div class="d-flex flex-row align-center w-full">
      <el-avatar :class="`mr-2 bg-white pa-2 border ${flippingLogo ? 'flipping-logo' : ''}`" :size="40" :src="deepChatLogo" />
      <el-input
        ref="AiInputComponentRef"
        class="ai-input"
        size="large"
        v-model="aiSessionContent"
        :placeholder="AI_SESSION_PLACEHOLDER"
        :readonly="aiRequestLoading"
        @input="onAISessionInput"
        @keyup.enter="onSendMeseageToAI"
      >
      <template #suffix>
        <el-tooltip effect="dark" :content="$t('chat.send')" placement="top">
          <el-button 
            color='#ddd'
            :loading="aiRequestLoading" 
            variant="flat"
            style="width: 60px; border-radius: 50px;" 
            :icon="Promotion" 
            @click="onSendMeseageToAI" 
          />
        </el-tooltip>
      </template>
    </el-input>
    </div>
    <div v-show="aiOutputVisible" class="mt-1 absolute output-container">
      <div class="output-wrapper">
        <span v-show="aiRequestLoading" class="loading-text mb-2" :style="{color: primaryColor}">
          {{ currentLoadingText }}
        </span>
        <div :id="AI_SESSION_OUTPUT_ID" ref="outputContentDivRef"> </div>
      </div>
      <div class="output-tools">
        <el-button 
          v-for="(item, index) in AI_SESSION_TOOLS" 
          :key="index" 
          :type="item.type" 
          size="small" 
          text
          @click="onToolAction(index+1)" 
        >{{ $t(`global.aiSession.${item.name}`) }}</el-button>
      </div>
    </div>
    <div class="mt-3 pl-11">
      <v-btn class="ml-2 btn-action" size="small" variant="outlined" @click="onSendMeseageToAI()">
        {{ $t('global.codeCompletion') }}
      </v-btn>
      <v-btn class="ml-2 btn-action" size="small" variant="outlined" @click="emits('onVisualize')">
        {{ $t('dataModel.visualize') }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.ai-session {
  position: fixed;

  left: 0;
  right: 0;
  margin: auto;

  width: 760px;
  height: 60px;

  z-index: 9999;

  .btn-action {
    background-color: #eee;
  }

  .output-container {
    right: 0;
    width: 710px;
    
    z-index: 99;
    border-radius: 8px;
    border: 1px solid #00d4ff;
    background-color: #fff;
    box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
  }

  .output-wrapper {
    padding: 10px;
    min-height: 120px;
    max-height: 200px;
    overflow-y: auto;
  }

  .output-tools {
    padding: 10px;
  }

  .loading-text {
    display: inline-block;
    animation: fadeInOut 1.5s ease-in-out infinite;
    transition: opacity 0.3s ease-in-out;
  }
}

/* AI风格的渐变边框输入框 */
.ai-input {
  position: relative;
}

.ai-input :deep(.el-input__wrapper) {
  /* background: linear-gradient(145deg, #1a1a2e, #16213e); */
  border: 2px solid transparent;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
  transition: all 0.3s ease;
}

.ai-input :deep(.el-input__wrapper):before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 12px;
  padding: 2px;
  background: linear-gradient(45deg, 
    #00d4ff, 
    #5b86e5, 
    #36d1dc, 
    #5b86e5, 
    #00d4ff
  );
  background-size: 300% 300%;
  animation: gradientShift 3s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: exclude;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}

.ai-input :deep(.el-input__wrapper):hover {
  box-shadow: 0 5px 10px rgba(0, 123, 255, 0.4);
  transform: translateY(-1px);
}

.ai-input :deep(.el-input__wrapper):focus-within {
  box-shadow: 0 5px 10px rgba(0, 123, 255, 0.6);
  transform: translateY(-2px);
}

.ai-input :deep(.el-input__inner) {
  background: transparent;
  border: none;
  /* color: #ffffff; */
  font-size: 16px;
  padding: 12px 16px;
}

.ai-input :deep(.el-input__inner)::placeholder {
  /* color: rgba(255, 255, 255, 0.6); */
  font-style: italic;
}

.ai-input :deep(.el-input__suffix) {
  color: #00d4ff;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 旋转Logo */
.flipping-logo {
  -webkit-animation-name: spinner;
  -webkit-animation-timing-function: linear;
  -webkit-animation-iteration-count: infinite;
  -webkit-animation-duration: 2s;
  animation-name: spinner;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-duration: 2s;
  -webkit-transform-style: preserve-3d;
  -moz-transform-style: preserve-3d;
  -ms-transform-style: preserve-3d;
  transform-style: preserve-3d;
}

/* WebKit and Opera browsers */ @-webkit-keyframes spinner {
  from
  {
    -webkit-transform: rotateY(0deg);
  }
  to {
    -webkit-transform: rotateY(-360deg);
  }
} /* all other browsers */
@keyframes spinner {
  from {
    -moz-transform: rotateY(0deg);
    -ms-transform: rotateY(0deg);
    transform: rotateY(0deg);
  }
  to
  {
    -moz-transform: rotateY(-360deg);
    -ms-transform: rotateY(-360deg);
    transform: rotateY(-360deg);

  }
}
</style>
