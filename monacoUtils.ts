import { loadMonaco } from "@/utils/monacoLoader";

import { type Position, type editor } from 'monaco-editor';
import { type Monaco } from '@monaco-editor/loader';
import { IModelValue } from "@/types/aiEditor";
/**
 * monaco静态配置, 将来可能改造为动态配置
 * 
 * @returns MonacoConfig
 */
export const MonacoConfig = (): editor.IStandaloneEditorConstructionOptions => {
  return {
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 16,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    roundedSelection: false,
    cursorStyle: "line",
    selectOnLineNumbers: true,
    contextmenu: true,
    scrollbar: {
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      vertical: "visible",
      horizontal: "visible",
    },
  }
}

type IModels = Array<{
  id: string;
  fileName: string;
  model: editor.ITextModel;
}>

export type IMonacoUtils = {
  cleariModels: () => void;
  focus: (model?: editor.ITextModel) => void;
  getCursorPos: () => {x: number, y: number};
  removeiModel: (index: number, id: string) => void;
  getCursorSelectionRangeText: () => string | false;
  initConstructModels: (array: Array<IModelValue>) => void;
  trigger: (action: string, source?: string, payload?: any) => void;
  getCurrentLineContent: () => {lineContent: string; position: Position;} | null;
  getScrolledVisiblePosition: (position?: Position) => { top: number, left: number, height: number } | null;
  readonly Editor: editor.IStandaloneCodeEditor;
  readonly Monaco: Monaco;
  readonly iModels: IModels;
}

export const createMonacoUtils = async(ID: string): Promise<IMonacoUtils> => {
  const Monaco = await loadMonaco()
  const Editor = Monaco.editor.create(
    <HTMLElement>document.getElementById(ID),
    { ...MonacoConfig() }
  )

  const iModels: IModels = []

  /**
   * 获取 monaco editor 光标在浏览器窗口的坐标
   * @returns { x: number, y: number }
   */
  const getCursorPos = (): {x: number, y: number} => {
    const position = Editor.getPosition();
    if (!position) return {x: 0, y: 0}

    const editorRect = Editor.getDomNode()?.getBoundingClientRect();

    const EditorOption = Monaco.editor.EditorOption;
    const lineHeight = Editor.getOption(EditorOption.lineHeight);
    const charWidth = Editor.getOption(EditorOption.fontSize);

    return {
      x: Math.round((editorRect as DOMRect).left + position.column * charWidth),
      y: Math.round((editorRect as DOMRect).top + position.lineNumber * lineHeight)
    }
  }

  /**
   * 获取 monaco editor 光标选中的文本
   * @returns string || false
   */
  const getCursorSelectionRangeText = () => {
    const selection = Editor.getSelection();
    if (!selection) return false

    const selectedText = Editor.getModel()?.getValueInRange(selection);
    return selectedText || false
  }

  const trigger = (action: string, source?: string, payload?: any) => {
    Editor.trigger(
      source || action, 
      !['selectAll', 'deleteLines'].includes(action) ? action : `editor.action.${action}`, 
      payload || null
    )
  }

  const initConstructModels = (array: IModelValue[]): IModels => {
    for (let index = 0; index < array.length; index++) {
      const { content, fileName, id, lang = 'sql' } = array[index];

      iModels.push({
        id,
        fileName,
        model: Monaco.editor.createModel(content, lang)
      })
    }
    return iModels;
  }

  const cleariModels = () => iModels.length = 0

  const removeiModel = (index: number, id: string) => {
    if (iModels[index].id === id) {
      iModels.splice(index, 1)
    } else {
      throw new Error('未找到相对应的model, 请检查index, id')
    }
  }

  const focus = (model?: editor.ITextModel) => {
    try {
      model = model || (Editor.getModel() as editor.ITextModel)
      const lineNumber = model.getLineCount();
      const column = model.getLineContent(lineNumber).length + 1;
      Editor.setPosition({ lineNumber, column })
      Editor.focus()
    } catch (error) {
      console.error(error);
    }
  }

  const getScrolledVisiblePosition = (position?: Position) => {
    position = position || (Editor.getPosition() as Position)
    if (position) {
      const lineContent = Editor.getModel()?.getLineContent(position.lineNumber)
      return Editor.getScrolledVisiblePosition({
        column: (<string>lineContent).length + 1,
        lineNumber: position.lineNumber
      })
    }
    return null
  }

  const getCurrentLineContent = (): {
    position: Position;
    lineContent: string;
  } | null => {
    const position = Editor.getPosition();
    if (!position) return null
    const model = Editor.getModel()
    const lineContent = model?.getLineContent(position.lineNumber) || ''
    return { lineContent, position }
  }

  return { Monaco, Editor, iModels, focus, trigger, cleariModels, 
    removeiModel, getCursorPos, getCurrentLineContent, initConstructModels, 
    getCursorSelectionRangeText, getScrolledVisiblePosition,
  }
}
