import { useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { ConnectionStatus } from "@/pages/WorkspaceEditor";
import { Loader2 } from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (code: string) => void;
  collaborators: { name: string; status: "online" | "idle" | "offline" }[];
  connectionStatus: ConnectionStatus;
  readOnly?: boolean;
  ydoc?: Y.Doc;
  provider?: WebsocketProvider | null;
  onDiagnosticsChange?: (markers: Array<{
    message: string;
    severity: number;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  }>) => void;
}

const CodeEditor = ({ code, language, onChange, collaborators, connectionStatus, readOnly, ydoc, provider, onDiagnosticsChange }: CodeEditorProps) => {
  const editorRef = useRef<any>(null);
  const bindingRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Map language names to Monaco language IDs
  const getMonacoLanguage = (lang: string) => {
    const map: Record<string, string> = {
      TypeScript: "typescript",
      JavaScript: "javascript",
      Python: "python",
      Go: "go",
      Rust: "rust",
      Java: "java",
      C: "c",
      "C++": "cpp",
      HTML: "html",
      CSS: "css",
      JSON: "json",
      Markdown: "markdown",
      SQL: "sql",
    };
    return map[lang] || "plaintext";
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register diagnostics listener
    const model = editor.getModel();
    if (model && onDiagnosticsChange) {
      const pushMarkers = () => {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri }) || [];
        onDiagnosticsChange(markers.map(m => ({
          message: m.message,
          severity: m.severity,
          startLineNumber: m.startLineNumber,
          startColumn: m.startColumn,
          endLineNumber: m.endLineNumber,
          endColumn: m.endColumn,
        })));
      };
      pushMarkers();
      const d = monaco.editor.onDidChangeMarkers(() => pushMarkers());
      editor.onDidDispose(() => { try { d.dispose(); } catch { } });
    }

    // If no Yjs available, set the code value directly
    if (!ydoc || !provider) {
      const model2 = editor.getModel();
      if (model2 && model2.getValue() !== code) {
        model2.setValue(code);
      }
    }
  };

  // Setup Yjs MonacoBinding whenever ydoc/provider/editor are all ready
  useEffect(() => {
    if (!ydoc || !provider || !editorRef.current) return;

    // Destroy old binding if exists
    if (bindingRef.current) {
      try { bindingRef.current.destroy(); } catch { }
      bindingRef.current = null;
    }

    const yText = ydoc.getText("monaco");
    const model = editorRef.current.getModel();
    if (!model) return;

    // Seed Yjs text from current code if Yjs document is empty
    if (yText.length === 0 && code && code.length > 0) {
      ydoc.transact(() => {
        yText.insert(0, code);
      });
    }

    // Create binding: Yjs ↔ Monaco
    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editorRef.current]),
      provider.awareness
    );
    bindingRef.current = binding;

    // Listen for changes from Yjs and propagate to parent
    const observer = () => {
      const val = yText.toString();
      onChange(val);
    };
    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
      try { binding.destroy(); } catch { }
      bindingRef.current = null;
    };
  }, [ydoc, provider, editorRef.current]);

  // When code prop changes from parent (file switch etc.) and no Yjs binding is active
  useEffect(() => {
    if (!editorRef.current || bindingRef.current) return;
    const model = editorRef.current.getModel();
    if (model && model.getValue() !== code) {
      model.setValue(code);
    }
  }, [code]);

  // Update Monaco language when language prop changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelLanguage(model, getMonacoLanguage(language));
    }
  }, [language]);

  const isReadOnly = !!readOnly || connectionStatus === "offline";

  return (
    <div className="relative flex flex-1 overflow-hidden" style={{ height: "100%", background: "#1e1e1e" }}>
      {connectionStatus === "reconnecting" && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 py-1.5 text-xs"
          style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24", borderBottom: "1px solid rgba(234,179,8,0.2)" }}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Reconnecting…
        </div>
      )}
      {connectionStatus === "offline" && !readOnly && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 py-1.5 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Offline — read-only mode
        </div>
      )}

      <Editor
        height="100%"
        language={getMonacoLanguage(language)}
        theme="vs-dark"
        defaultValue={code}
        onChange={(value) => {
          // Only propagate if not controlled by Yjs
          if (!bindingRef.current) onChange(value || "");
        }}
        onMount={handleEditorDidMount}
        options={{
          readOnly: isReadOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', monospace",
          fontLigatures: true,
          lineHeight: 22,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          formatOnPaste: true,
          formatOnType: false,
          wordWrap: "off",
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full gap-2" style={{ color: "#858585" }}>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading editor…</span>
          </div>
        }
      />
    </div>
  );
};

export default CodeEditor;
