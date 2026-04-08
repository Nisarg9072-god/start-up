import { cn } from "@/lib/utils";
import {
  Files,
  Search,
  GitBranch,
  Play,
  Users,
  Settings,
  ChevronLeft,
  Share2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/UI/tooltip";

export type ActivityBarPanel = "explorer" | "search" | "git" | "run" | "users" | null;

interface VSCodeActivityBarProps {
  activePanel: ActivityBarPanel;
  onPanelChange: (panel: ActivityBarPanel) => void;
  onShare: () => void;
  onSettings: () => void;
}

const topItems = [
  { id: "explorer" as const, icon: Files, label: "Explorer (Ctrl+Shift+E)" },
  { id: "search" as const, icon: Search, label: "Search (Ctrl+Shift+F)" },
  { id: "git" as const, icon: GitBranch, label: "Source Control (Ctrl+Shift+G)" },
  { id: "run" as const, icon: Play, label: "Run & Debug (Ctrl+Shift+D)" },
  { id: "users" as const, icon: Users, label: "Collaborators" },
];

const VSCodeActivityBar = ({ activePanel, onPanelChange, onShare, onSettings }: VSCodeActivityBarProps) => {
  return (
    <div
      className="flex flex-col items-center justify-between flex-shrink-0 select-none"
      style={{
        width: 48,
        background: "#333333",
        borderRight: "1px solid #252526",
      }}
    >
      {/* Top icons */}
      <div className="flex flex-col items-center w-full pt-1">
        {topItems.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onPanelChange(activePanel === id ? null : id)}
                className={cn(
                  "relative flex items-center justify-center w-full h-12 transition-colors",
                  "hover:text-white group",
                  activePanel === id
                    ? "text-white"
                    : "text-[#858585] hover:text-white"
                )}
              >
                {/* Active indicator */}
                {activePanel === id && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-white rounded-r-sm" />
                )}
                <Icon size={24} strokeWidth={activePanel === id ? 1.8 : 1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center w-full pb-1">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={onShare}
              className="flex items-center justify-center w-full h-12 text-[#858585] hover:text-white transition-colors"
            >
              <Share2 size={22} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Share Workspace</TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={onSettings}
              className="flex items-center justify-center w-full h-12 text-[#858585] hover:text-white transition-colors"
            >
              <Settings size={22} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default VSCodeActivityBar;
