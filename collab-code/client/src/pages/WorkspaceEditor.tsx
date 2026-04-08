// WorkspaceIDE — VS Code style layout
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import SidePanel from "@/components/workspace/SidePanel";
import CodeEditor from "@/components/workspace/CodeEditor";
import ShareModal from "@/components/workspace/ShareModal";
import VersionHistory from "@/components/workspace/VersionHistory";
import UsageLimitDialog from "@/components/workspace/UsageLimitDialog";
import VSCodeActivityBar, { type ActivityBarPanel } from "@/components/workspace/VSCodeActivityBar";
import VSCodeMenuBar from "@/components/workspace/VSCodeMenuBar";
import VSCodeStatusBar from "@/components/workspace/VSCodeStatusBar";
import { api, openWorkspaceSocket } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/UI/dialog";
import { Input } from "@/components/UI/input";
import { Button } from "@/components/UI/button";
import { toast } from "@/components/UI/use-toast";
import { Play, X } from "lucide-react";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface File {
  id: string;
  name: string;
  language: string;
  content?: string;
  updatedAt?: string;
}

const WorkspaceEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [shareOpen, setShareOpen] = useState(false);
  const [language, setLanguage] = useState("TypeScript");
  const [connectionStatus] = useState<ConnectionStatus>("connected");

  // VS Code Activity Bar
  const [activePanel, setActivePanel] = useState<ActivityBarPanel>("explorer");

  // File State
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);

  // Version History & Auto-save State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Activity State
  const [activity, setActivity] = useState<{ message: string; time: string }[]>([]);

  // Create File State
  const [createOpen, setCreateOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [runLoading, setRunLoading] = useState(false);
  const [runStdin, setRunStdin] = useState("");
  const [runHistory, setRunHistory] = useState<{ stdout: string; stderr: string; exitCode: number; durationMs: number; language: string; when: string }[]>([]);

  // Terminal / Sidebar resizing
  const [terminalHeight, setTerminalHeight] = useState<number>(240);
  const [dragging, setDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragStartHeight, setDragStartHeight] = useState<number>(240);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const v = localStorage.getItem("cc.sidebarWidth");
    return v ? parseInt(v, 10) : 240;
  });
  const [dragSidebar, setDragSidebar] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragStartSidebarWidth, setDragStartSidebarWidth] = useState<number>(240);

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [bottomTab, setBottomTab] = useState<string>(() => localStorage.getItem("cc.bottomTab") || "terminal");
  const [problems, setProblems] = useState<Array<{
    message: string;
    severity: number;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  }>>([]);

  const [editingLocked, setEditingLocked] = useState<boolean>(false);
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { user } = useAuth();

  const MOCK_PARTICIPANTS = [
    { name: "You", status: "online" as const },
  ];

  // Language detector
  const detectLanguage = (name: string, content: string, fallback: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "js" || ext === "jsx") return "JavaScript";
    if (ext === "ts" || ext === "tsx") return "TypeScript";
    if (ext === "py") return "Python";
    if (ext === "go") return "Go";
    if (ext === "rs") return "Rust";
    if (ext === "html") return "HTML";
    if (ext === "css") return "CSS";
    if (ext === "json") return "JSON";
    if (ext === "md" || ext === "markdown") return "Markdown";
    if (ext === "sql") return "SQL";
    if (content?.startsWith("#!")) {
      if (content.includes("python")) return "Python";
      if (content.includes("node")) return "JavaScript";
    }
    return fallback || "JavaScript";
  };

  // Fetch files and activity
  useEffect(() => {
    if (id) {
      setLoading(true);
      Promise.all([
        api.files.list(id),
        api.workspaces.activity(id)
      ]).then(([fetchedFiles, fetchedActivity]) => {
        const safeFiles: File[] = Array.isArray(fetchedFiles) ? fetchedFiles : [];
        setFiles(safeFiles);
        if (safeFiles.length > 0) {
          setActiveFileId(safeFiles[0].id);
        }
        const safeActivity: any[] = Array.isArray(fetchedActivity) ? fetchedActivity : [];
        const processedActivity = safeActivity.map((a: any) => {
          let actionText = (a.actionType || "updated").replace(/_/g, " ").toLowerCase();
          if (a.actionType === "FILE_UPDATED") actionText = "updated file";
          if (a.actionType === "FILE_CREATED") actionText = "created file";
          if (a.actionType === "FILE_DELETED") actionText = "deleted file";
          if (a.actionType === "FILE_RESTORED") actionText = "restored file";
          const fileName = a.metadata?.fileName || a.fileName || "a file";
          const userEmail = a.user?.email || a.userEmail || "Unknown user";
          return {
            message: `${userEmail} ${actionText} ${fileName}`,
            time: a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : "recently"
          };
        });
        setActivity(processedActivity);
      }).catch(console.error).finally(() => setLoading(false));
    }
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [id]);

  // Collab token & Yjs setup
  useEffect(() => {
    if (!id || !activeFileId) return;
    let destroyed = false;
    api.workspaces.collabToken(id).then(res => {
      if (destroyed) return;
      const token = res?.token;
      if (!token) return;

      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
        const ws = openWorkspaceSocket(id, token, (data) => {
          if (!data?.type) return;
          if (data.type === "file_created") {
            setFiles(prev => { if (prev.find(f => f.id === data.payload?.id)) return prev; return [...prev, data.payload as File]; });
          } else if (data.type === "file_deleted") {
            setFiles(prev => prev.filter(f => f.id !== data.payload?.id));
            setActiveFileId(prev => prev === data.payload?.id ? null : prev);
          } else if (data.type === "file_renamed") {
            setFiles(prev => prev.map(f => f.id === data.payload?.id ? { ...f, name: data.payload.name } : f));
          }
        });
        if (ws) wsRef.current = ws;
      }

      setProvider(prev => {
        if (prev) prev.destroy();
        const serverUrl = window.location.hostname === "localhost"
          ? "ws://localhost:3001"
          : `wss://${window.location.hostname}:3001`;
        const p = new WebsocketProvider(serverUrl, activeFileId, ydoc, { params: { token } });
        p.awareness.setLocalStateField("user", {
          name: user?.displayName || user?.email || "User",
          color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        });
        return p;
      });
    }).catch(() => { /* collab optional */ });
    return () => { destroyed = true; };
  }, [id, activeFileId]);

  // Usage tracking
  useEffect(() => {
    if (!id || !user?.id) return;
    let lastPulseAt = Date.now();
    const fetchStatus = async () => {
      try {
        const res = await api.usage.status();
        if (res.success && res.data) {
          if (res.data.exceeded) setEditingLocked(true);
          else setEditingLocked(false);
        }
      } catch { /* silent */ }
    };
    fetchStatus();
    const tick = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPulseAt >= 30000) {
        lastPulseAt = now;
        try { await api.usage.report(id, 30); await fetchStatus(); } catch { /* silent */ }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [id]);

  // Persist terminal height
  useEffect(() => {
    const v = localStorage.getItem("cc.terminalHeight");
    if (v) { const n = parseInt(v, 10); if (!Number.isNaN(n)) setTerminalHeight(n); }
  }, []);
  useEffect(() => { localStorage.setItem("cc.terminalHeight", String(terminalHeight)); }, [terminalHeight]);
  useEffect(() => { localStorage.setItem("cc.sidebarWidth", String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem("cc.bottomTab", bottomTab); }, [bottomTab]);

  // Resize mouse handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging && dragStartY !== null) {
        const dy = e.clientY - dragStartY;
        setTerminalHeight(Math.min(Math.max(dragStartHeight + dy, 80), window.innerHeight - 100));
      }
      if (dragSidebar && dragStartX !== null) {
        const dx = e.clientX - dragStartX;
        setSidebarWidth(Math.min(Math.max(dragStartSidebarWidth + dx, 160), Math.floor(window.innerWidth * 0.5)));
      }
    };
    const onUp = () => {
      if (dragging) { setDragging(false); setDragStartY(null); }
      if (dragSidebar) { setDragSidebar(false); setDragStartX(null); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragStartY, dragStartHeight, dragSidebar, dragStartX, dragStartSidebarWidth]);

  // Fetch file content when active file changes
  useEffect(() => {
    if (activeFileId) {
      const file = files.find(f => f.id === activeFileId);
      if (file) {
        if (file.content === undefined) {
          api.files.get(activeFileId).then(fullFile => {
            setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: fullFile.content } : f));
            setCode(fullFile.content || "");
            setLanguage(detectLanguage(fullFile.name, fullFile.content, fullFile.language));
          }).catch(console.error);
        } else {
          setCode(file.content);
          setLanguage(detectLanguage(file.name, file.content, file.language));
        }
      }
    } else {
      setCode("");
    }
  }, [activeFileId]);

  // Auto-save on code change
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (activeFileId) {
        const file = files.find(f => f.id === activeFileId);
        if (file && file.content !== code) {
          setSaveStatus("saving");
          setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: code } : f));
          api.files.update(activeFileId, { content: code })
            .then(() => { setSaveStatus("saved"); setLastSavedAt(new Date()); })
            .catch(() => setSaveStatus("error"));
        }
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [code, activeFileId]);

  // Restore version
  const handleRestoreVersion = async (versionId: string) => {
    if (!activeFileId || !id) return;
    const updatedFile = await api.files.restore(activeFileId, versionId);
    if (updatedFile?.content) {
      setCode(updatedFile.content);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: updatedFile.content } : f));
    } else {
      const f = await api.files.get(activeFileId);
      setCode(f.content);
      setFiles(prev => prev.map(file => file.id === activeFileId ? { ...file, content: f.content } : file));
    }
    api.workspaces.activity(id).then(fetchedActivity => {
      setActivity(Array.isArray(fetchedActivity) ? fetchedActivity.map((a: any) => ({
        message: `${a.user?.email || "User"} restored file`,
        time: formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })
      })) : []);
    }).catch(() => {});
  };

  // Create file
  const handleCreateFile = async () => {
    if (!id || !newFileName) return;
    try {
      const lang = detectLanguage(newFileName, "", "JavaScript");
      const newFile = await api.files.create(id, newFileName, "", lang);
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setLanguage(lang);
      setCreateOpen(false);
      setNewFileName("");
      toast({ title: "File created", description: newFileName });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  // Export
  const handleExport = async () => {
    if (!id) return;
    try {
      const blob = await api.workspaces.export(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `workspace-${id}-export.zip`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast({ title: "Exported" });
    } catch { toast({ variant: "destructive", title: "Export Failed" }); }
  };

  // Run code
  const handleRun = async () => {
    if (!activeFileId) { toast({ title: "No file selected" }); return; }
    setRunLoading(true);
    try {
      const idMap: Record<string, number> = { Python: 71, JavaScript: 63, TypeScript: 74, "C++": 54, C: 50, Java: 62, Go: 60, Rust: 73 };
      const stdinNorm = runStdin && runStdin.length > 0 ? (runStdin.endsWith("\n") ? runStdin : runStdin + "\n") : runStdin;
      let result: any;
      try { result = await api.runner.runJudge0(code, idMap[language] || 63, stdinNorm, activeFileId); }
      catch { result = await api.runner.runFile(activeFileId, language, stdinNorm); }
      setRunHistory(prev => [
        { stdout: result.stdout || "", stderr: result.stderr || "", exitCode: result.exitCode, durationMs: result.durationMs, language, when: new Date().toLocaleTimeString() },
        ...prev
      ].slice(0, 20));
      setBottomTab("terminal");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Run failed", description: e?.message });
    } finally { setRunLoading(false); }
  };

  const activeFileObj = files.find(f => f.id === activeFileId);

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#1e1e1e", color: "#d4d4d4" }}>
      <UsageLimitDialog />

      {/* ── VS Code Menu Bar ── */}
      <VSCodeMenuBar
        workspaceName="CollabCode"
        activeFile={activeFileObj?.name}
        language={language}
        onLanguageChange={(lang) => { setLanguage(lang); if (activeFileId) api.files.update(activeFileId, { language: lang }).catch(() => {}); }}
        onRun={handleRun}
        onExport={handleExport}
        onShowHistory={() => activeFileId && setHistoryOpen(true)}
        runLoading={runLoading}
      />

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Activity Bar ── */}
        <VSCodeActivityBar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onShare={() => setShareOpen(true)}
          onSettings={() => {}}
        />

        {/* ── Side Panel ── */}
        {activePanel && (
          <>
            <div className="flex flex-col h-full overflow-hidden flex-shrink-0"
              style={{ width: sidebarWidth, background: "#252526", borderRight: "1px solid #1e1e1e" }}>

              {/* Panel header */}
              <div className="flex items-center px-4 py-2 flex-shrink-0"
                style={{ fontSize: 11, color: "#bbb", letterSpacing: "0.1em", borderBottom: "1px solid #3c3c3c", textTransform: "uppercase" }}>
                {activePanel === "explorer" && "Explorer"}
                {activePanel === "search" && "Search"}
                {activePanel === "git" && "Source Control"}
                {activePanel === "run" && "Run & Debug"}
                {activePanel === "users" && "Collaborators"}
              </div>

              {/* Explorer */}
              {activePanel === "explorer" && (
                <SidePanel
                  files={files.map(f => ({ id: f.id, name: f.name, active: f.id === activeFileId }))}
                  participants={MOCK_PARTICIPANTS}
                  activity={activity}
                  activeFileId={activeFileId}
                  onFileSelect={setActiveFileId}
                  onFileCreate={() => setCreateOpen(true)}
                  awareness={provider?.awareness}
                  onFolderCreate={async (folderName) => {
                    if (!id) return;
                    const clean = folderName.trim().replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
                    if (!clean) return;
                    try { const m = await api.files.create(id, `${clean}/.keep`, "", "plaintext"); setFiles(prev => [...prev, m]); }
                    catch (e: any) { toast({ variant: "destructive", title: "Create failed", description: e?.message }); }
                  }}
                  onCreateFileInFolder={async (folder, fileName) => {
                    if (!id) return;
                    const full = `${folder}/${fileName.trim()}`;
                    try {
                      const lang = detectLanguage(full, "", "plaintext");
                      const f = await api.files.create(id, full, "", lang);
                      setFiles(prev => [...prev, f]); setActiveFileId(f.id); setLanguage(lang);
                    } catch (e: any) { toast({ variant: "destructive", title: "Create failed", description: e?.message }); }
                  }}
                  onRenameFile={async (fileId, newFullName) => {
                    try {
                      const updated = await api.files.update(fileId, { name: newFullName });
                      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: updated.name } : f));
                      if (activeFileId === fileId) setLanguage(detectLanguage(updated.name, code, updated.language));
                    } catch (e: any) { toast({ variant: "destructive", title: "Rename failed", description: e?.message }); }
                  }}
                  onDeleteFile={async (fileId) => {
                    try {
                      await api.files.delete(fileId);
                      setFiles(prev => prev.filter(f => f.id !== fileId));
                      if (activeFileId === fileId) { setActiveFileId(null); setCode(""); }
                    } catch (e: any) { toast({ variant: "destructive", title: "Delete failed", description: e?.message }); }
                  }}
                  onRenameFolder={async (folder, newName) => {
                    if (!id) return;
                    const from = folder.replace(/\/+$/, "");
                    const to = newName.trim().replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
                    if (!to) return;
                    try {
                      for (const f of files.filter(f => f.name.startsWith(from + "/")))
                        await api.files.update(f.id, { name: `${to}/${f.name.slice(from.length + 1)}` });
                      setFiles(await api.files.list(id));
                    } catch (e: any) { toast({ variant: "destructive", title: "Rename failed", description: e?.message }); }
                  }}
                  onDeleteFolder={async (folder) => {
                    if (!id) return;
                    try {
                      for (const f of files.filter(f => f.name.startsWith(folder + "/"))) await api.files.delete(f.id);
                      const refreshed = await api.files.list(id);
                      setFiles(refreshed);
                      if (activeFileId && !refreshed.find((f: any) => f.id === activeFileId)) { setActiveFileId(null); setCode(""); }
                    } catch (e: any) { toast({ variant: "destructive", title: "Delete failed", description: e?.message }); }
                  }}
                  width={sidebarWidth}
                />
              )}

              {/* Users */}
              {activePanel === "users" && (
                <div className="flex-1 overflow-auto p-3">
                  <div className="mb-2" style={{ color: "#858585", fontSize: 11 }}>ONLINE USERS</div>
                  {MOCK_PARTICIPANTS.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5">
                      <span className={`w-2 h-2 rounded-full ${p.status === "online" ? "bg-green-400" : "bg-gray-500"}`} />
                      <span style={{ color: "#d4d4d4", fontSize: 13 }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Run */}
              {activePanel === "run" && (
                <div className="flex-1 p-3 space-y-3">
                  <div style={{ fontSize: 11, color: "#858585" }}>RUN & DEBUG</div>
                  <button onClick={handleRun}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-white w-full justify-center"
                    style={{ background: "#0e7a39" }}>
                    <Play size={13} />{runLoading ? "Running…" : `Run ${activeFileObj?.name || "file"}`}
                  </button>
                </div>
              )}

              {/* Git */}
              {activePanel === "git" && (
                <div className="flex-1 p-3" style={{ fontSize: 13, color: "#858585" }}>
                  <div className="mb-2" style={{ fontSize: 11 }}>SOURCE CONTROL</div>
                  <div className="text-xs">No pending changes.</div>
                </div>
              )}

              {/* Search */}
              {activePanel === "search" && (
                <div className="flex-1 p-3 space-y-2">
                  <div style={{ fontSize: 11, color: "#858585" }}>SEARCH</div>
                  <input className="w-full px-2 py-1 rounded text-xs outline-none"
                    style={{ background: "#3c3c3c", border: "1px solid #555", color: "#d4d4d4" }}
                    placeholder="Search in files…" />
                </div>
              )}
            </div>

            {/* Sidebar resize handle */}
            <div className="h-full cursor-col-resize flex-shrink-0 hover:bg-[#007acc]/40 transition-colors"
              style={{ width: 3 }}
              onMouseDown={(e) => { setDragSidebar(true); setDragStartX(e.clientX); setDragStartSidebarWidth(sidebarWidth); }} />
          </>
        )}

        {/* ── Editor + Terminal ── */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "#1e1e1e" }}>

          {/* ── Editor Tab Bar ── */}
          <div className="flex items-end flex-shrink-0 overflow-x-auto"
            style={{ background: "#252526", borderBottom: "1px solid #1e1e1e", height: 35, minHeight: 35 }}>
            {files.map((f) => {
              const isActive = f.id === activeFileId;
              const ext = f.name.split(".").pop()?.toLowerCase() || "";
              const dotColor = ext === "ts" || ext === "tsx" ? "#4ec9b0" : ext === "js" || ext === "jsx" ? "#f0c27f" : ext === "py" ? "#4b8bbe" : "#858585";
              return (
                <div key={f.id} onClick={() => setActiveFileId(f.id)}
                  className="flex items-center gap-1.5 px-3 h-full flex-shrink-0 cursor-pointer group relative"
                  style={{
                    background: isActive ? "#1e1e1e" : "transparent",
                    color: isActive ? "#fff" : "#969696",
                    borderRight: "1px solid #252526",
                    borderTop: isActive ? "1px solid #007acc" : "1px solid transparent",
                    maxWidth: 200, fontSize: 13,
                  }}>
                  <span style={{ color: dotColor, fontSize: 9 }}>●</span>
                  <span className="truncate max-w-[130px]">{f.name.split("/").pop()}</span>
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity rounded ml-1 flex-shrink-0"
                    style={{ color: "#858585" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (files.length > 1) {
                        const idx = files.findIndex(file => file.id === f.id);
                        setActiveFileId((files[idx + 1] || files[idx - 1])?.id ?? null);
                      }
                    }}>
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center justify-center px-3 h-full flex-shrink-0 hover:bg-white/5 transition-colors"
              style={{ color: "#858585", fontSize: 18 }} title="New File">+</button>
            {activeFileId && (
              <button onClick={handleRun}
                className="ml-auto mr-2 flex items-center gap-1.5 px-3 py-0.5 rounded text-xs flex-shrink-0"
                style={{ background: runLoading ? "#264f78" : "#0e7a39", color: "#fff" }}
                title="Run (F5)">
                <Play size={11} />{runLoading ? "Running…" : "▶ Run"}
              </button>
            )}
          </div>

          {/* ── Monaco Editor ── */}
          <div className="flex-1 overflow-hidden" style={{ background: "#1e1e1e" }}>
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#858585" }}>
                <div style={{ fontSize: 56, opacity: 0.08 }}>⌨</div>
                <div style={{ fontSize: 14 }}>No files open</div>
                <button onClick={() => setCreateOpen(true)} className="px-4 py-2 rounded text-sm" style={{ background: "#0e639c", color: "#fff" }}>New File</button>
              </div>
            ) : !activeFileId ? (
              <div className="flex items-center justify-center h-full" style={{ color: "#858585", fontSize: 14 }}>
                Select a file to edit
              </div>
            ) : (
              <CodeEditor
                code={code} language={language} onChange={setCode}
                collaborators={MOCK_PARTICIPANTS.filter(p => p.name !== "You")}
                connectionStatus={connectionStatus} readOnly={editingLocked}
                ydoc={ydoc} provider={provider} onDiagnosticsChange={setProblems}
              />
            )}
          </div>

          {/* ── Bottom Panel ── */}
          <div className="flex flex-col flex-shrink-0" style={{ height: terminalHeight, background: "#1e1e1e", borderTop: "1px solid #3c3c3c" }}>
            {/* Resize handle */}
            <div className="h-[3px] w-full cursor-row-resize flex-shrink-0 hover:bg-[#007acc]/60 transition-colors"
              onMouseDown={(e) => { setDragging(true); setDragStartY(e.clientY); setDragStartHeight(terminalHeight); }} />

            {/* Panel tabs */}
            <div className="flex items-center flex-shrink-0" style={{ background: "#252526", borderBottom: "1px solid #3c3c3c", height: 35 }}>
              {(["terminal", "output", "problems", "debug"] as const).map((tab) => (
                <button key={tab} onClick={() => setBottomTab(tab)}
                  className="h-full px-4 text-xs capitalize transition-colors"
                  style={{ color: bottomTab === tab ? "#fff" : "#969696", background: "transparent", borderBottom: bottomTab === tab ? "1px solid #007acc" : "1px solid transparent" }}>
                  {tab === "debug" ? "Debug Console" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "problems" && problems.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1 rounded" style={{ background: "#f14c4c", color: "#fff" }}>{problems.length}</span>
                  )}
                </button>
              ))}
              <div className="ml-auto flex items-center pr-3">
                <span className="text-xs" style={{ color: "#858585" }}>
                  {runHistory.length > 0 ? `${runHistory[0].when} · exit ${runHistory[0].exitCode}` : ""}
                </span>
              </div>
            </div>

            {/* Terminal */}
            {bottomTab === "terminal" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0" style={{ borderBottom: "1px solid #2d2d2d" }}>
                  <span style={{ fontSize: 11, color: "#858585" }}>stdin:</span>
                  <input className="flex-1 bg-transparent text-xs font-mono outline-none" style={{ color: "#d4d4d4" }}
                    placeholder="Program input…" value={runStdin}
                    onChange={(e) => setRunStdin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRun()} />
                  <button onClick={handleRun} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0"
                    style={{ background: "#0e639c", color: "#fff" }}>
                    <Play size={10} />{runLoading ? "…" : "Run"}
                  </button>
                  <button onClick={() => setRunHistory([])} className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                    style={{ background: "#3c3c3c", color: "#d4d4d4" }}>Clear</button>
                </div>
                <div ref={terminalRef} className="flex-1 overflow-auto px-3 py-2 font-mono"
                  style={{ fontSize: 13, lineHeight: 1.6, background: "#1e1e1e" }}>
                  {runHistory.length === 0
                    ? <div style={{ color: "#858585" }}>Terminal ready. Click Run or press Enter in stdin.</div>
                    : runHistory.map((h, i) => (
                      <div key={i} className="mb-3">
                        <div className="mb-0.5" style={{ color: "#569cd6", fontSize: 11 }}>[{h.when}] {h.language} · exit {h.exitCode} in {h.durationMs}ms</div>
                        {h.stdout && <pre className="whitespace-pre-wrap" style={{ color: "#4ec9b0" }}>{h.stdout}</pre>}
                        {h.stderr && <pre className="whitespace-pre-wrap" style={{ color: "#f14c4c" }}>{h.stderr}</pre>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Output */}
            {bottomTab === "output" && (
              <div className="flex-1 overflow-auto px-3 py-2 font-mono" style={{ fontSize: 13, background: "#1e1e1e" }}>
                {runHistory.length === 0
                  ? <div style={{ color: "#858585" }}>No output yet.</div>
                  : runHistory.map((h, i) => (
                    <div key={i} className="mb-3">
                      <div style={{ color: "#569cd6", fontSize: 11 }}>[{h.when}] exit {h.exitCode}</div>
                      {h.stdout && <pre className="whitespace-pre-wrap" style={{ color: "#4ec9b0" }}>{h.stdout}</pre>}
                      {h.stderr && <pre className="whitespace-pre-wrap" style={{ color: "#f14c4c" }}>{h.stderr}</pre>}
                    </div>
                  ))}
              </div>
            )}

            {/* Problems */}
            {bottomTab === "problems" && (
              <div className="flex-1 overflow-auto px-3 py-2" style={{ fontSize: 13, background: "#1e1e1e" }}>
                {problems.length === 0
                  ? <div style={{ color: "#858585" }}>No problems detected.</div>
                  : problems.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <span style={{ color: p.severity <= 8 ? "#f14c4c" : "#cca700", fontSize: 11 }}>●</span>
                      <div>
                        <div style={{ color: "#d4d4d4", fontSize: 12 }}>{p.message}</div>
                        <div style={{ color: "#858585", fontSize: 11 }}>Ln {p.startLineNumber}, Col {p.startColumn}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Debug Console */}
            {bottomTab === "debug" && (
              <div className="flex-1 overflow-auto px-3 py-2 font-mono" style={{ fontSize: 13, color: "#569cd6", background: "#1e1e1e" }}>
                {runHistory.length === 0
                  ? <div style={{ color: "#858585" }}>No debug output.</div>
                  : runHistory.map((h, i) => (
                    <div key={i} className="mb-3">
                      <div style={{ fontSize: 11, color: "#858585" }}>[{h.when}]</div>
                      <pre className="whitespace-pre-wrap">{JSON.stringify({ exit: h.exitCode, ms: h.durationMs, stdout: h.stdout, stderr: h.stderr }, null, 2)}</pre>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── VS Code Blue Status Bar ── */}
      <VSCodeStatusBar
        connectionStatus={connectionStatus}
        language={language}
        cursorLine={1}
        cursorCol={1}
        lineCount={code.split("\n").length}
        saveStatus={saveStatus}
        errorCount={problems.filter(p => p.severity <= 8).length}
        warningCount={problems.filter(p => p.severity > 8).length}
      />

      {/* ── Modals ── */}
      <ShareModal open={shareOpen} onOpenChange={setShareOpen} workspaceId={id || ""} currentUserId={user?.id} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ background: "#252526", border: "1px solid #454545", color: "#d4d4d4" }}>
          <DialogHeader><DialogTitle style={{ color: "#fff" }}>New File</DialogTitle></DialogHeader>
          <div className="py-3">
            <Input placeholder="filename.ts" value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
              style={{ background: "#3c3c3c", border: "1px solid #555", color: "#d4d4d4" }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}
              style={{ background: "transparent", color: "#d4d4d4", borderColor: "#555" }}>Cancel</Button>
            <Button onClick={handleCreateFile} style={{ background: "#0e639c", color: "#fff", border: "none" }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionHistory open={historyOpen} onClose={() => setHistoryOpen(false)} fileId={activeFileId} onRestore={handleRestoreVersion} />
    </div>
  );
};

export default WorkspaceEditor;
