import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/UI/dropdown-menu";
import { Sun, Moon, LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/UI/tooltip";

const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "C++", "C", "Java", "HTML", "CSS", "JSON", "Markdown", "SQL"];

interface VSCodeMenuBarProps {
  workspaceName?: string;
  activeFile?: string;
  language: string;
  onLanguageChange: (lang: string) => void;
  onRun?: () => void;
  onExport?: () => void;
  onShowHistory?: () => void;
  runLoading?: boolean;
}

const VSCodeMenuBar = ({
  workspaceName,
  activeFile,
  language,
  onLanguageChange,
  onRun,
  onExport,
  onShowHistory,
  runLoading,
}: VSCodeMenuBarProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const menuStyle: React.CSSProperties = {
    height: 30,
    background: "#3c3c3c",
    borderBottom: "1px solid #252526",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 8,
    userSelect: "none",
    flexShrink: 0,
  };

  const menuBtnStyle = "px-2 py-0.5 text-[12px] text-[#ccc] hover:bg-white/10 rounded cursor-pointer transition-colors select-none";

  return (
    <div style={menuStyle}>
      {/* Left — Menu items */}
      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>File</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem onClick={onExport} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Export Workspace…
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#454545]" />
            <DropdownMenuItem onClick={() => navigate("/")} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Close Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Edit</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white" onClick={() => document.execCommand('undo')}>
              Undo <span className="ml-auto text-[#858585]">Ctrl+Z</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white" onClick={() => document.execCommand('redo')}>
              Redo <span className="ml-auto text-[#858585]">Ctrl+Y</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Selection</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white" onClick={() => document.execCommand('selectAll')}>
              Select All <span className="ml-auto text-[#858585]">Ctrl+A</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Expand Selection <span className="ml-auto text-[#858585]">Shift+Alt+→</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>View</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem onClick={onShowHistory} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Version History
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#454545]" />
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Appearance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Go</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Back <span className="ml-auto text-[#858585]">Alt+←</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Forward <span className="ml-auto text-[#858585]">Alt+→</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Run</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem onClick={onRun} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white" disabled={runLoading}>
              Start Debugging <span className="ml-auto text-[#858585]">F5</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRun} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white" disabled={runLoading}>
              Run Without Debugging <span className="ml-auto text-[#858585]">Ctrl+F5</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Terminal</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              New Terminal <span className="ml-auto text-[#858585]">Ctrl+Shift+`</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Split Terminal <span className="ml-auto text-[#858585]">Ctrl+\</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Help</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[180px]">
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Welcome
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              Documentation
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#454545]" />
            <DropdownMenuItem className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Run</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[200px]">
            <DropdownMenuItem onClick={onRun} className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white">
              {runLoading ? "Running…" : "Run File"} <span className="ml-auto text-[#858585]">F5</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span className={menuBtnStyle}>Language</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ background: "#252526", border: "1px solid #454545", borderRadius: 4 }} className="min-w-[160px] max-h-64 overflow-y-auto">
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className="text-[#ccc] text-xs focus:bg-[#094771] focus:text-white"
              >
                {lang === language && <span className="mr-2 text-[#007acc]">✓</span>}
                {lang !== language && <span className="mr-2 w-3 inline-block" />}
                {lang}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center — workspace title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-[12px] text-[#ccc] pointer-events-none">
        {activeFile ? `${activeFile} — ${workspaceName || "CollabCode"}` : (workspaceName || "CollabCode")}
      </div>

      {/* Right — theme + user */}
      <div className="flex items-center gap-1">
        {user && (
          <span className="text-[11px] text-[#858585] mr-1 hidden sm:inline">{user.displayName || user.email}</span>
        )}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center justify-center w-6 h-6 text-[#858585] hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Toggle Theme</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center w-6 h-6 text-[#858585] hover:text-red-400 hover:bg-white/10 rounded transition-colors"
            >
              <LogOut size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Leave Workspace</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default VSCodeMenuBar;
