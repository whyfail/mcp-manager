import { GitBranch, X, Loader2, Check } from 'lucide-react';

export interface GitSkillCandidate {
  name: string;
  description: string | null;
  subpath: string;
}

interface GitPickModalProps {
  open: boolean;
  candidates: GitSkillCandidate[];
  selected: GitSkillCandidate[];
  loading: boolean;
  onToggle: (candidate: GitSkillCandidate) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function GitPickModal({ open, candidates, selected, loading, onToggle, onConfirm, onCancel }: GitPickModalProps) {
  if (!open) return null;

  const isSelected = (c: GitSkillCandidate) =>
    selected.some((s) => s.subpath === c.subpath);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border border-[hsl(var(--border))] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">选择要安装的技能</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              已选择 {selected.length} 个技能
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
          >
            <X size={18} className="text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[hsl(var(--muted-foreground))]" />
              <span className="ml-3 text-sm text-[hsl(var(--muted-foreground))]">正在扫描仓库...</span>
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-2">
              {candidates.map((candidate, index) => {
                const checked = isSelected(candidate);
                return (
                  <button
                    key={index}
                    onClick={() => onToggle(candidate)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${
                      checked
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/10]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--muted)/30)]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checked
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                      }`}
                    >
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0">
                      <GitBranch size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{candidate.name}</div>
                      {candidate.description && (
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">
                          {candidate.description}
                        </div>
                      )}
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                        {candidate.subpath}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
              未在仓库中找到有效的技能
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-4 sm:px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/30)] flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))]"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={selected.length === 0}
            className="flex-1 px-4 py-2.5 bg-[hsl(var(--primary))] hover:brightness-[0.9] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加 {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GitPickModal;
