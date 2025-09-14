/*
 * @Author: LiuYFei 
 * @Date: 2025-07-03 22:36:22 
 * @Last Modified by: LiuYFei
 * @Last Modified time: 2025-08-11 15:18:16
 * 
 * useAISession hook 
 */

import { reactive, ref, readonly } from "vue"

export const useAISession = () => {
  // AISession 组件的激活状态, 显示 | 隐藏 
  const activateAiSession = ref(false)
  // AISession 组件样式
  const aiSessionStyle = reactive({ })
  // AISession ai-session 用户输入的内容
  const aiSessionContent = ref('');

  const aiRequestLoading = ref(false)

  const aiOutputVisible = ref(false)

  /**
   * @description 清除 AI Session 组件用户输入
   * @author liuyufei
   */
  const resetAiSessionContent = () => aiSessionContent.value = ''

  /**
   * @description 获取 AISession 组件的激活状态
   * @author liuyufei
   * @returns {boolean} true-激活, false-未激活
   */
  const getAiSessionActivateState = () => activateAiSession.value

  /**
   * @description 更新 AISession 组件的样式
   * @author liuyufei
   * @param {object} style AISession 组件的样式
   */
  const onUpdateAiSessionStyle = style => Object.assign(aiSessionStyle, style)
  
  /**
   * @description 关闭 AISession 组件
   * @author liuyufei
   * @param {function} callback 关闭后的回调函数
   */
  const onCloseAiSession = (
    callback?: () => void
  ) => {
    activateAiSession.value = false
    callback && callback()
  }
  
  /**
   * @description 打开 AISession 组件
   * @author liuyufei
   * @param {function} callback 打开后的回调函数
   */
  const onOpenAiSession = async (
    callback?: () => void
  ) => {
    activateAiSession.value = true;
    callback && callback()
  }

  return {
    aiRequestLoading,
    aiSessionContent,
    aiOutputVisible,
    aiSessionStyle: readonly(aiSessionStyle),
    activateAiSession: readonly(activateAiSession), 
    onCloseAiSession, 
    onOpenAiSession, 
    getAiSessionActivateState,
    onUpdateAiSessionStyle,
    resetAiSessionContent
  }
}
