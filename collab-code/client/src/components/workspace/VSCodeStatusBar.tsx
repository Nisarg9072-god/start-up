import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/pages/WorkspaceEditor";
import { GitBranch, AlertCircle, AlertTriangle, CheckCircle, Wifi, WifiOff, Loader2 } from "lucide-react";

interface VSCodeStatusBarProps {
  connectionStatus: ConnectionStatus;
  language: string;
  cursorLine?: number;
  cursorCol?: number;
  lineCount?: number;
  saveStatus?: "saved" | "saving" | "error";
  gitBranch?: string;
  errorCount?: number;
  warningCount?: number;
  encoding?: string;
  eol?: string;
}

const VSCodeStatusBar = ({
  connectionStatus,
  language,
  cursorLine = 1,
  cursorCol = 1,
  lineCount = 0,
  saveStatus = "saved",
  gitBranch = "main",
  errorCount = 0,
  warningCount = 0,
  encoding = "UTF-8",
  eol = "LF",
}: VSCodeStatusBarProps) => {
  const isConnected = connectionStatus === "connected";
  const isReconnecting = connectionStatus === "reconnecting";

  return (
    <div
      className="flex items-center justify-between flex-shrink-0 text-white select-none overflow-hidden"
      style={{
        height: 22,
        background: isConnected ? "#007acc" : isReconnecting ? "#f59e0b" : "#6b7280",
        fontSize: 12,
        paddingInline: 0,
      }}
    >
      {/* Left */}
      <div className="flex items-center h-full">
        {/* Git branch */}
        <button className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          <GitBranch size={13} />
          <span>{gitBranch}</span>
        </button>

        {/* Errors/Warnings */}
        <button className="flex items-center gap-2 px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          <span className="flex items-center gap-1">
            <AlertCircle size={13} />
            {errorCount}
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={13} />
            {warningCount}
          </span>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center h-full">
        {/* Save status */}
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1 px-2 h-full whitespace-nowrap hover:bg-white/10">
            <Loader2 size={11} className="animate-spin" />
            Saving…
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex items-center gap-1 px-2 h-full whitespace-nowrap hover:bg-white/10 bg-red-500/40">
            <AlertCircle size={11} />
            Save Error
          </span>
        )}

        {/* Connection */}
        <button className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          {isConnected && <Wifi size={12} />}
          {isReconnecting && <Loader2 size={12} className="animate-spin" />}
          {!isConnected && !isReconnecting && <WifiOff size={12} />}
          <span className="capitalize">{connectionStatus}</span>
        </button>

        {/* Ln/Col */}
        <button className="px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          Ln {cursorLine}, Col {cursorCol}
        </button>

        {/* Line count */}
        <span className="px-2 h-full flex items-center hover:bg-white/10 whitespace-nowrap">
          {lineCount} lines
        </span>

        {/* Encoding */}
        <button className="px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          {encoding}
        </button>

        {/* EOL */}
        <button className="px-2 h-full hover:bg-white/10 transition-colors whitespace-nowrap">
          {eol}
        </button>

        {/* Language */}
        <button className="px-3 h-full hover:bg-white/10 transition-colors font-medium whitespace-nowrap">
          {language}
        </button>
      </div>
    </div>
  );
};

export default VSCodeStatusBar;
