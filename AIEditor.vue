<script setup lang="ts">
import { onMounted, ref, watch, toRaw, nextTick, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { debounce } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { useAISession } from "@/hooks/useAISession";
import { type IMonacoUtils, createMonacoUtils } from "@/utils/monacoUtils";
import AISession from "./AISession.vue";
import AIEditorTab from "./AIEditorTab.vue";
import { ID, PLACEHOLDER_TEXT } from "./constants";
import { IModelValue, IProps, ITab } from "@/types/aiEditor";

const {
  aiSessionStyle,
  activateAiSession,
  onCloseAiSession,
  onOpenAiSession,
  getAiSessionActivateState,
  onUpdateAiSessionStyle,
} = useAISession();

const tabs = ref<Array<ITab>>([]);
const PlaceholderRef = ref<HTMLElement | null>(null);
const AISessionComponentRef = ref<typeof AISession | null>(null);

const emits = defineEmits(["update:modelValue", "onVisualize", "onRemoveTab", "onSwitchTab", "onNewTab"]);
const props = withDefaults(defineProps<IProps>(), {
  disabled: false,
  visibleAddTab: true,
  monacoContainerID: ID,
});

let internalUpdateFlag = false;
let MonacoUtils: IMonacoUtils;

onMounted(async () => {
  MonacoUtils = await createMonacoUtils(props.monacoContainerID);

  if (Array.isArray(props.modelValue)) {
    if (props.modelValue.length > 0) {
      onUpdatedView(toRaw(props.modelValue));
    }
  }
  if (typeof props.modelValue === "string") {
    onUpdatedModelValueString(props.modelValue);
  }

  MonacoUtils.Editor.onDidChangeModelContent(
    debounce(() => {
      const currentValue = MonacoUtils.Editor.getValue();

      if (Array.isArray(props.modelValue)) {
        internalUpdateFlag = true;
        const index = tabs.value.findIndex((tab) => tab.actived);
        props.modelValue[index].content = currentValue;
      }
      if (typeof props.modelValue === "string" && currentValue !== props.modelValue) {
        emits("update:modelValue", currentValue);
      }
    }, 500)
  );

  if (!props.disabled) {
    MonacoUtils.Editor.onDidChangeCursorPosition(({ position }) => {
      onPlaceholder(position);
    });
    MonacoUtils.Editor.addCommand(MonacoUtils.Monaco.KeyMod.CtrlCmd | MonacoUtils.Monaco.KeyCode.KeyJ, onActivatedAI);
    MonacoUtils.Editor.onKeyUp(debounce(onKeySpace, 300));
  }

  document.addEventListener("keydown", handleGlobalKeyDown);
});

onUnmounted(() => {
  if (MonacoUtils) MonacoUtils.Editor.dispose();
  // 移除键盘事件监听器
  document.removeEventListener("keydown", handleGlobalKeyDown);
});

const handleGlobalKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && getAiSessionActivateState()) {
    onEmitCloseAISession();
  }
};

const onEmitCloseAISession = () => {
  onCloseAiSession();
  MonacoUtils.trigger("cancelSelection");
  MonacoUtils.focus();
};

const onKeySpace = ({ code }) => {
  if (code === "Space") {
    const _object = MonacoUtils.getCurrentLineContent();
    if (_object) {
      const { position, lineContent } = _object;
      if (position.column === 2 && !lineContent.trim().length) {
        MonacoUtils.trigger("undo");
        onActivatedAI();
      }
    }
  }
};

const onActivatedAI = async () => {
  const cursorPos = MonacoUtils.getCursorPos();
  onUpdateAiSessionStyle({ top: `${cursorPos.y + 10}px` });
  await nextTick();
  MonacoUtils.trigger("selectAll");
  onOpenAiSession();
  await nextTick();
  AISessionComponentRef.value?.focus();
};

const onNewTab = () => {
  const id = uuidv4();
  if (Array.isArray(props.modelValue)) {
    props.modelValue.push({ content: "", fileName: id, id: `custom-${id}` });
    emits("onNewTab");
  }
};

const onSwitchTab = (activedTab: ITab) => {
  for (let i = 0; i < tabs.value.length; i++) {
    const t = tabs.value[i];
    t.actived = t.id === activedTab.id;
  }
  const index = tabs.value.findIndex((t) => t.actived);
  setEditorModel(index);
  emits("onSwitchTab", index);
};

const onRemoveTab = (activedTab: ITab) => {
  if (Array.isArray(props.modelValue)) {
    const delIndex = tabs.value.findIndex((t) => t.id === activedTab.id);

    if (activedTab.actived) {
      props.modelValue.splice(delIndex, 1);
    } else {
      internalUpdateFlag = true;

      props.modelValue.splice(delIndex, 1);
      tabs.value.splice(delIndex, 1);
      try {
        MonacoUtils.removeiModel(delIndex, activedTab.id);
      } catch (error) {
        console.error(error);
      }
      MonacoUtils.Editor.focus();
    }
    emits("onRemoveTab", delIndex);
  }
};

const onEditTabName = async ({ newName, index }, closeEditDialog: () => void) => {
  const tab = tabs.value.find((t) => t.name === newName);
  if (tab) {
    return ElMessage.warning("file name cannot be repeated!");
  }

  if (Array.isArray(props.modelValue)) {
    internalUpdateFlag = true;

    tabs.value[index].name = newName;
    tabs.value[index].title = newName;
    MonacoUtils.iModels[index].fileName = newName;
    props.modelValue[index].fileName = newName;

    closeEditDialog();
    await nextTick();
    MonacoUtils.Editor.focus();
  }
};

const onUpdatedView = (modelValues: IModelValue[]) => {
  if (MonacoUtils) {
    if (internalUpdateFlag) return (internalUpdateFlag = false);

    MonacoUtils.cleariModels();
    MonacoUtils.initConstructModels(modelValues);

    const modelActivedIndex = modelValues.findIndex(model => model.actived)
    const activedIndex = modelActivedIndex < 0 ? modelValues.length - 1 : modelActivedIndex;
    setEditorModel(activedIndex);

    tabs.value = modelValues.map(({ fileName, id }, index) => {
      return {
        id: id,
        title: fileName,
        name: fileName,
        actived: index === activedIndex,
      };
    });
  }
};

const onUpdatedModelValueString = (value: string) => {
  const model = MonacoUtils.Editor.getModel();
  if (model) {
    model.setValue(value);
    MonacoUtils.focus(model);
    onPlaceholder();
  }
};

const setEditorModel = (index: number) => {
  const model = MonacoUtils.iModels[index].model;
  MonacoUtils.Editor.setModel(model);
  MonacoUtils.focus(model);
  onPlaceholder();
};

const onPlaceholder = (position?, closed = false) => {
  const pos = MonacoUtils.getScrolledVisiblePosition(position);

  if (PlaceholderRef.value && pos) {
    if (closed) return (PlaceholderRef.value.style.display = "none");
    PlaceholderRef.value.style.top = `${pos.top}px`;
    PlaceholderRef.value.style.left = `${pos.left + 5}px`;
    PlaceholderRef.value.style.display = "initial";
  }
};

watch(
  () => props.modelValue,
  (newValue) => {
    if (MonacoUtils) {
      if (Array.isArray(newValue)) {
        onUpdatedView(toRaw(newValue));
      }

      if (typeof newValue === "string") {
        onUpdatedModelValueString(newValue);
      }
    }
  },
  { deep: true }
);

defineExpose({
  getActivedIndex: () => tabs.value.findIndex((t) => t.actived),
});
</script>

<template>
  <div class="ai-editor-container h-full d-flex flex-col">
    <AIEditorTab
      v-if="Array.isArray(props.modelValue) && props.modelValue.length"
      :tabs="tabs"
      :visibleAddTab="props.visibleAddTab"
      @onNewTab="onNewTab"
      @onSwitchTab="onSwitchTab"
      @onRemoveTab="onRemoveTab"
      @onEditTabName="onEditTabName"
    />
    <slot name="model-description"></slot>
    <div class="ai-editor flex-1 w-full" :id="props.monacoContainerID">
      <div class="placeholder" ref="PlaceholderRef">{{ PLACEHOLDER_TEXT }}</div>
    </div>
    <AISession
      ref="AISessionComponentRef"
      :MonacoUtils="MonacoUtils"
      :schemaData="props.schemaData"
      :aiSessionStyle="aiSessionStyle"
      :activateAiSession="activateAiSession"
      @onEmitCloseAISession="onEmitCloseAISession"
      @onVisualize="() => emits('onVisualize', MonacoUtils.Editor.getValue())"
    />
  </div>
</template>

<style scoped lang="scss">
.ai-editor {
  overflow: hidden;
  position: relative;

  .placeholder {
    display: none;
    position: absolute;
    top: 0;
    left: 80px;
    pointer-events: none;
    color: #888;
    z-index: 1;
    opacity: 0.7;
  }
}
</style>
