import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Check,
  Plus,
  Terminal,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface AgentInfo {
  id: string;
  name: string;
  config_path: string;
  exists: boolean;
  mcp_count: number;
}

interface NewAgentModalProps {
  agents: AgentInfo[];
  installedAgents: AgentInfo[];
  onClose: () => void;
  onSyncComplete: () => void;
}

const NewAgentModal: React.FC<NewAgentModalProps> = ({
  agents,
  installedAgents,
  onClose,
  onSyncComplete,
}) => {
  const [selectedAgents, setSelectedAgents] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      agents.forEach((a) => (initial[a.id] = true));
      return initial;
    }
  );
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [selectedApps, setSelectedApps] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      installedAgents.forEach((a) => (initial[a.id] = true));
      return initial;
    }
  );

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleApp = (id: string) => {
    setSelectedApps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncedCount(0);

    const selectedAgentIds = Object.entries(selectedAgents)
      .filter(([_, v]) => v)
      .map(([id]) => id);

    const enabledApps = Object.entries(selectedApps)
      .filter(([_, v]) => v)
      .map(([id]) => id);

    let total = 0;
    for (const agentId of selectedAgentIds) {
      try {
        const count = await invoke<number>("sync_agent_mcp", {
          agentId,
          enabledApps,
        });
        total += count;
        setSyncedCount(total);
      } catch (e) {
        console.error(`Failed to sync ${agentId}:`, e);
      }
    }

    setSyncing(false);
    onSyncComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] shadow-2xl border border-[hsl(var(--border))] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[hsl(var(--border))] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Plus size={16} className="text-emerald-500 sm:hidden" />
              <Plus size={20} className="text-emerald-500 hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">发现新的 AI 工具</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                检测到 {agents.length} 个新安装的工具，是否同步其 MCP 配置？
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors flex-shrink-0"
          >
            <X size={18} className="text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* 检测到的工具列表 */}
        <div className="px-4 sm:px-6 py-4 border-b border-[hsl(var(--border))] overflow-y-auto flex-1 min-h-0">
          <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
            检测到的工具
          </h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
                  selectedAgents[agent.id]
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--muted))/50]"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedAgents[agent.id]
                      ? "bg-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
                  }`}
                >
                  {selectedAgents[agent.id] && (
                    <Check size={12} className="text-white" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Terminal size={16} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {agent.mcp_count} 个 MCP
                  </span>
                  <ArrowRight size={14} className="text-[hsl(var(--muted-foreground))]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 集成到的工具 */}
        <div className="px-4 sm:px-6 py-4 border-b border-[hsl(var(--border))] flex-shrink-0">
          <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
            同步到以下工具
          </h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {installedAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleApp(agent.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedApps[agent.id]
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-[hsl(var(--muted))/30] flex-shrink-0">
          <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] order-2 sm:order-1 w-full sm:w-auto">
            {syncing ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                已同步 {syncedCount} 个服务器...
              </span>
            ) : (
              `将同步 ${
                Object.values(selectedAgents).filter(Boolean).length
              } 个工具的配置`
            )}
          </div>
          <div className="flex gap-2 order-1 sm:order-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              稍后同步
            </button>
            <button
              onClick={handleSync}
              disabled={
                syncing ||
                !Object.values(selectedAgents).some(Boolean) ||
                !Object.values(selectedApps).some(Boolean)
              }
              className="px-4 sm:px-5 py-2 bg-[hsl(var(--primary))] hover:brightness-110 active:brightness-90 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? "同步中..." : "同步 MCP 配置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAgentModal;
