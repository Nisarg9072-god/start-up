import * as monaco from 'monaco-editor';

export type MonacoEditorInstance = monaco.editor.IStandaloneCodeEditor;

export type SidebarSection = 'explorer' | 'search' | 'git' | 'run' | 'extensions' | 'participants' | 'activity' | 'ai';
export type BottomTab = 'terminal' | 'output' | 'problems' | 'debug';

export interface IDEState {
  sidebar: {
    visible: boolean;
    width: number;
    activeSection: SidebarSection;
  };
  panel: {
    visible: boolean;
    height: number;
    activeTab: BottomTab;
  };
  editor: {
    openFiles: string[];
    activeFileId: string | null;
  };
}

export interface EditorTab {
  id: string;
  name: string;
  isDirty?: boolean;
}

export type MonacoRef = {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof monaco | null;
};
