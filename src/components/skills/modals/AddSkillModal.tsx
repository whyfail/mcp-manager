import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import * as dialog from '@tauri-apps/plugin-dialog';
import { GitBranch, Folder, Search, X, ChevronRight, Loader2, Check, Globe, Star, ArrowLeft, ExternalLink, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { ToolOption, OnlineSkillDto } from '../types';
import GitPickModal, { type GitSkillCandidate } from './GitPickModal';
import { APP_COLORS } from '@/lib/tools';

interface FeaturedSkillDto {
  slug: string;
  name: string;
  summary: string;
  downloads: number;
  stars: number;
  source_url: string;
}

interface AddSkillModalProps {
  open: boolean;
  onClose: () => void;
  tools: ToolOption[];
  syncTargets: Record<string, boolean>;
  onSyncTargetChange: (toolId: string, checked: boolean) => void;
  onSkillAdded: () => void;
}

type Tab = 'git' | 'local' | 'online';

/** Git 标签页的阶段：input=输入URL | previewed=已预览 */
type GitPhase = 'input' | 'previewed';

function AddSkillModal({ open, onClose, tools, syncTargets, onSyncTargetChange, onSkillAdded }: AddSkillModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('git');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [gitName, setGitName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [localName, setLocalName] = useState('');
  const [localValid, setLocalValid] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  // 验证本地文件夹是否为合规的技能目录
  const validateLocalPath = useCallback(async (path: string) => {
    if (!path.trim()) {
      setLocalValid(false);
      setLocalValidationError(null);
      return;
    }
    try {
      const result = await invoke<{ valid: boolean; reason: string | null }>('validate_local_skill', { path: path.trim() });
      setLocalValid(result.valid);
      setLocalValidationError(result.valid ? null : result.reason);
    } catch (err) {
      setLocalValid(false);
      setLocalValidationError(err instanceof Error ? err.message : String(err));
    }
  }, []);
  const [onlineQuery, setOnlineQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OnlineSkillDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Featured skills state
  const [featuredSkills, setFeaturedSkills] = useState<FeaturedSkillDto[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);

  // Detail modal state
  const [detailSkill, setDetailSkill] = useState<FeaturedSkillDto | OnlineSkillDto | null>(null);

  // Git scanning state
  const [gitScanLoading, setGitScanLoading] = useState(false);
  const [gitScanError, setGitScanError] = useState<string | null>(null);
  const [gitCandidates, setGitCandidates] = useState<GitSkillCandidate[]>([]);
  const [selectedGitCandidates, setSelectedGitCandidates] = useState<GitSkillCandidate[]>([]);
  const [showGitPickModal, setShowGitPickModal] = useState(false);
  const [gitPhase, setGitPhase] = useState<GitPhase>('input');

  // 每个选中候选技能的自定义名称映射：subpath -> 自定义名称
  const [gitSkillNames, setGitSkillNames] = useState<Record<string, string>>({});

  // Load featured skills when entering online tab
  useEffect(() => {
    if (activeTab === 'online' && featuredSkills.length === 0) {
      loadFeaturedSkills();
    }
  }, [activeTab]);

  const loadFeaturedSkills = async () => {
    setFeaturedLoading(true);
    try {
      const skills = await invoke<FeaturedSkillDto[]>('get_featured_skills');
      setFeaturedSkills(skills);
    } catch (err) {
      console.error('Failed to load featured skills:', err);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const resetGitState = useCallback(() => {
    setGitCandidates([]);
    setSelectedGitCandidates([]);
    setGitScanError(null);
    setGitPhase('input');
    setGitName('');
    setGitSkillNames({});
  }, []);

  const handleScanGitRepo = useCallback(async () => {
    if (!gitUrl.trim()) {
      setGitScanError('请输入 Git 仓库 URL');
      return;
    }
    setGitScanLoading(true);
    setGitScanError(null);
    setGitCandidates([]);
    setSelectedGitCandidates([]);
    setGitSkillNames({});
    try {
      const candidates = await invoke<GitSkillCandidate[]>('list_git_skills', {
        repoUrl: gitUrl.trim(),
      });

      if (candidates.length === 0) {
        setGitScanError('未在仓库中找到有效的技能');
        return;
      }

      setGitCandidates(candidates);

      if (candidates.length === 1) {
        // 单个技能：直接进入预览状态
        setSelectedGitCandidates([candidates[0]]);
        setGitName(candidates[0].name);
        setGitPhase('previewed');
      } else {
        // 多个技能：弹出选择窗口
        setSelectedGitCandidates([candidates[0]]);
        setGitSkillNames({ [candidates[0].subpath]: candidates[0].name });
        setShowGitPickModal(true);
      }
    } catch (err) {
      console.error('[DEBUG] list_git_skills error:', err);
      setGitScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setGitScanLoading(false);
    }
  }, [gitUrl]);

  const handleGitCandidateToggle = useCallback((candidate: GitSkillCandidate) => {
    setSelectedGitCandidates((prev) => {
      const exists = prev.some((c) => c.subpath === candidate.subpath);
      if (exists) {
        // 移除时也清理名称映射
        setGitSkillNames(names => {
          const next = { ...names };
          delete next[candidate.subpath];
          return next;
        });
        return prev.filter((c) => c.subpath !== candidate.subpath);
      } else {
        // 添加时初始化名称映射
        setGitSkillNames(names => ({
          ...names,
          [candidate.subpath]: candidate.name,
        }));
        return [...prev, candidate];
      }
    });
  }, []);

  // GitPickModal 确认：关闭弹窗，进入预览状态
  const handleGitCandidatesConfirm = useCallback(() => {
    if (selectedGitCandidates.length === 0) {
      toast.warning('请先选择要安装的技能');
      return;
    }
    setShowGitPickModal(false);
    setGitPhase('previewed');
  }, [selectedGitCandidates]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setDetailSkill(null);
    // Reset git scanning state when switching tabs
    if (tab !== 'git') {
      resetGitState();
    }
  };

  const handlePickLocalPath = useCallback(async () => {
    try {
      const selected = await dialog.open({
        directory: true,
        multiple: false,
        title: '选择本地文件夹'
      });
      if (!selected || Array.isArray(selected)) return;
      setLocalPath(selected);
      validateLocalPath(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [validateLocalPath]);

  // 点击"添加技能"按钮
  const handleCreateGit = useCallback(async () => {
    if (!gitUrl.trim()) {
      setError('请输入Git仓库URL');
      return;
    }

    // 如果还在 input 阶段，先预览
    if (gitPhase === 'input') {
      await handleScanGitRepo();
      return;
    }

    // previewed 阶段，开始安装
    const selectedTools = tools.filter(tool => syncTargets[tool.id]);
    setLoading(true);
    setError(null);

    try {
      const installedNames: string[] = [];

      for (const candidate of selectedGitCandidates) {
        // 单个技能用 gitName，多个技能用各自 gitSkillNames 中的值
        const customName = selectedGitCandidates.length === 1
          ? gitName.trim()
          : (gitSkillNames[candidate.subpath]?.trim() || candidate.name);
        const skillName = customName || candidate.name;

        const created = await invoke<{
          id: string;
          name: string;
          central_path: string;
        }>('install_git_selection', {
          repoUrl: gitUrl.trim(),
          subpath: candidate.subpath,
          name: skillName,
        });

        for (const tool of selectedTools) {
          await invoke('sync_skill_to_tool', {
            skillId: created.id,
            skillName: created.name,
            tool: tool.id,
            sourcePath: created.central_path,
          });
        }

        installedNames.push(created.name);
      }

      setGitUrl('');
      resetGitState();
      toast.success(`${installedNames.length > 1 ? `技能 "${installedNames.join(', ')}"` : `技能 "${installedNames[0]}"`} 添加成功`);
      onClose();
      onSkillAdded();
    } catch (err) {
      console.error('[DEBUG] install_git error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gitUrl, gitPhase, selectedGitCandidates, gitName, gitSkillNames, handleScanGitRepo, tools, syncTargets, onClose, onSkillAdded, resetGitState]);

  const handleCreateLocal = useCallback(async () => {
    if (!localPath.trim()) {
      setError('请选择本地文件夹');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await invoke<{
        id: string;
        name: string;
        central_path: string;
      }>('install_local_selection', {
        basePath: localPath.trim(),
        subpath: '',
        name: localName.trim() || undefined
      });

      const selectedTools = tools.filter(tool => syncTargets[tool.id]);
      for (const tool of selectedTools) {
        await invoke('sync_skill_to_tool', {
          skillId: created.id,
          skillName: created.name,
          tool: tool.id,
          sourcePath: created.central_path,
        });
      }

      setLocalPath('');
      setLocalName('');
      toast.success(`技能 "${created.name}" 添加成功`);
      onClose();
      onSkillAdded();
    } catch (err) {
      console.error('[DEBUG] install_local_selection error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [localPath, localName, tools, syncTargets, onClose, onSkillAdded]);

  const handleSearchOnline = useCallback(async () => {
    if (!onlineQuery.trim()) {
      setSearchError('请输入搜索关键词');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await invoke<OnlineSkillDto[]>('search_skills_online', {
        query: onlineQuery.trim(),
        limit: 20
      });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('未找到相关技能');
      }
    } catch (err) {
      console.error('[DEBUG] search_skills_online error:', err);
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearchLoading(false);
    }
  }, [onlineQuery]);

  const handleSelectFeatured = (skill: FeaturedSkillDto) => {
    setGitUrl(skill.source_url);
    setGitName(skill.name);
    setActiveTab('git');
    resetGitState();
  };

  const toggleTool = (toolId: string) => {
    onSyncTargetChange(toolId, !syncTargets[toolId]);
  };

  const toggleAllTools = () => {
    const allEnabled = tools.every(t => syncTargets[t.id]);
    tools.forEach(t => onSyncTargetChange(t.id, !allEnabled));
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  if (!open) return null;

  // Git 标签页是否处于预览状态
  const isGitPreviewed = activeTab === 'git' && gitPhase === 'previewed';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-[hsl(var(--card))] rounded-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl border border-[hsl(var(--border))] flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-[hsl(var(--border))] flex-shrink-0">
            <div className="min-w-0 flex items-center gap-3">
              {activeTab === 'online' && detailSkill && (
                <button
                  onClick={() => setDetailSkill(null)}
                  className="p-1.5 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} className="text-[hsl(var(--muted-foreground))]" />
                </button>
              )}
              {isGitPreviewed && (
                <button
                  onClick={() => {
                    resetGitState();
                    setError(null);
                  }}
                  className="p-1.5 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} className="text-[hsl(var(--muted-foreground))]" />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold truncate">
                  {detailSkill ? '技能详情' : '添加技能'}
                </h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {activeTab === 'online' && !detailSkill
                    ? '浏览和搜索在线技能'
                    : activeTab === 'online' && detailSkill
                    ? detailSkill.name
                    : isGitPreviewed
                    ? '确认技能信息后添加'
                    : '从 Git 仓库、本地文件夹添加'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors flex-shrink-0"
              disabled={loading}
            >
              <X size={18} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>

          {/* 表单内容 */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5 min-h-0">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* 在线搜索详情页 */}
            {activeTab === 'online' && detailSkill ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0">
                    <GitBranch size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold">{detailSkill.name}</h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {('source' in detailSkill ? detailSkill.source : detailSkill.source_url.replace('https://github.com/', ''))}
                    </p>
                  </div>
                </div>

                {'summary' in detailSkill && detailSkill.summary && (
                  <div className="p-4 rounded-lg bg-[hsl(var(--muted))]">
                    <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
                      {detailSkill.summary}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-6">
                  {'stars' in detailSkill && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Star size={14} className="text-yellow-500" />
                      <span>{formatCount(detailSkill.stars)}</span>
                    </div>
                  )}
                  {'downloads' in detailSkill && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-[hsl(var(--muted-foreground))]">下载:</span>
                      <span>{formatCount(detailSkill.downloads)}</span>
                    </div>
                  )}
                  {'installs' in detailSkill && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-[hsl(var(--muted-foreground))]">安装:</span>
                      <span>{formatCount(detailSkill.installs)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      const url = 'source_url' in detailSkill ? detailSkill.source_url : '';
                      if (url) openUrl(url);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-sm font-medium transition-all"
                  >
                    <ExternalLink size={14} />
                    查看源码
                  </button>
                  <button
                    onClick={() => handleSelectFeatured(detailSkill as FeaturedSkillDto)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--primary))] hover:brightness-[0.9] text-white text-sm font-medium transition-all"
                    disabled={loading}
                  >
                    <GitBranch size={14} />
                    添加此技能
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 标签页 - 预览状态时隐藏 */}
                {!isGitPreviewed && (
                  <div className="flex rounded-lg bg-[hsl(var(--muted))] p-1">
                    <button
                      onClick={() => handleTabChange('git')}
                      className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'git'
                          ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <GitBranch size={14} />
                      <span>Git 仓库</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('local')}
                      className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'local'
                          ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <Folder size={14} />
                      <span>本地文件夹</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('online')}
                      className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'online'
                          ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      <Globe size={14} />
                      <span>在线搜索</span>
                    </button>
                  </div>
                )}

                {/* ===== Git 标签页 ===== */}
                {activeTab === 'git' && (
                  <div className="space-y-4">
                    {/* Git 仓库 URL */}
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        Git 仓库 URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={gitUrl}
                          onChange={(e) => {
                            setGitUrl(e.target.value);
                            // URL 变化时重置预览状态
                            if (gitPhase === 'previewed') {
                              resetGitState();
                            }
                          }}
                          placeholder="例如: https://github.com/username/repo.git"
                          className="flex-1 px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={loading || gitScanLoading || gitPhase === 'previewed'}
                        />
                        {gitPhase === 'previewed' && (
                          <button
                            onClick={() => {
                              resetGitState();
                              setError(null);
                            }}
                            className="px-4 py-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2"
                          >
                            <RotateCcw size={14} />
                            重选
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 扫描错误 */}
                    {gitScanError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {gitScanError}
                      </div>
                    )}

                    {/* ===== 预览后：单个技能 ===== */}
                    {gitPhase === 'previewed' && selectedGitCandidates.length === 1 && (
                      <>
                        <div>
                          <label className="text-sm font-medium mb-2 flex items-center gap-2">
                            技能名称 <span className="text-[hsl(var(--muted-foreground))] font-normal">(可选)</span>
                          </label>
                          <input
                            type="text"
                            value={gitName}
                            onChange={(e) => setGitName(e.target.value)}
                            placeholder="留空则使用仓库名称"
                            className="w-full px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                            disabled={loading}
                          />
                        </div>

                        {/* 同步到工具 */}
                        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] p-3 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">同步到工具</label>
                            {tools.length > 0 && (
                              <button
                                type="button"
                                onClick={toggleAllTools}
                                className="text-xs text-[hsl(var(--primary))] hover:underline flex-shrink-0"
                              >
                                {tools.every(t => syncTargets[t.id]) ? '取消全选' : '全选'}
                              </button>
                            )}
                          </div>
                          {tools.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tools.map(tool => {
                                const enabled = syncTargets[tool.id] ?? false;
                                return (
                                  <button
                                    key={tool.id}
                                    type="button"
                                    onClick={() => toggleTool(tool.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                                      enabled
                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]"
                                        : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))]"
                                    }`}
                                    disabled={loading}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                                        enabled
                                          ? APP_COLORS[tool.id as keyof typeof APP_COLORS] || "bg-[hsl(var(--foreground))]"
                                          : "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
                                      }`}
                                    >
                                      {enabled && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm">{tool.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                              未检测到已安装的 AI 工具。
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* ===== 预览后：多个技能 ===== */}
                    {gitPhase === 'previewed' && selectedGitCandidates.length > 1 && (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-[hsl(var(--primary))]" />
                              <span className="text-xs font-medium text-[hsl(var(--primary))]">
                                已选择 {selectedGitCandidates.length} 个技能
                              </span>
                            </div>
                            <button
                              onClick={() => setShowGitPickModal(true)}
                              className="text-xs text-[hsl(var(--primary))] hover:underline"
                            >
                              重新选择
                            </button>
                          </div>
                          {selectedGitCandidates.map((candidate) => (
                            <div
                              key={candidate.subpath}
                              className="p-3 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))/5] space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <GitBranch size={12} className="text-[hsl(var(--primary))] flex-shrink-0" />
                                  <span className="text-sm font-medium truncate">{candidate.name}</span>
                                </div>
                                <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono flex-shrink-0 ml-2">
                                  {candidate.subpath}
                                </span>
                              </div>
                              {candidate.description && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{candidate.description}</p>
                              )}
                              <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                  技能名称 <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(可选，留空使用默认)</span>
                                </label>
                                <input
                                  type="text"
                                  value={gitSkillNames[candidate.subpath] ?? candidate.name}
                                  onChange={(e) =>
                                    setGitSkillNames(prev => ({
                                      ...prev,
                                      [candidate.subpath]: e.target.value,
                                    }))
                                  }
                                  placeholder={candidate.name}
                                  className="w-full px-3 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                                  disabled={loading}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 同步到工具 */}
                        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] p-3 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">同步到工具</label>
                            {tools.length > 0 && (
                              <button
                                type="button"
                                onClick={toggleAllTools}
                                className="text-xs text-[hsl(var(--primary))] hover:underline flex-shrink-0"
                              >
                                {tools.every(t => syncTargets[t.id]) ? '取消全选' : '全选'}
                              </button>
                            )}
                          </div>
                          {tools.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tools.map(tool => {
                                const enabled = syncTargets[tool.id] ?? false;
                                return (
                                  <button
                                    key={tool.id}
                                    type="button"
                                    onClick={() => toggleTool(tool.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                                      enabled
                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]"
                                        : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))]"
                                    }`}
                                    disabled={loading}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                                        enabled
                                          ? APP_COLORS[tool.id as keyof typeof APP_COLORS] || "bg-[hsl(var(--foreground))]"
                                          : "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
                                      }`}
                                    >
                                      {enabled && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm">{tool.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                              未检测到已安装的 AI 工具。
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ===== 本地文件夹标签页 ===== */}
                {activeTab === 'local' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 flex items-center gap-2">
                        本地文件夹
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={localPath}
                          onChange={(e) => {
                            setLocalPath(e.target.value);
                            validateLocalPath(e.target.value);
                          }}
                          placeholder="选择或输入文件夹路径"
                          className="flex-1 px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                          disabled={loading}
                        />
                        <button
                          onClick={handlePickLocalPath}
                          className="px-4 py-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] hover:brightness-[0.95] text-sm font-medium transition-all whitespace-nowrap"
                          disabled={loading}
                        >
                          浏览
                        </button>
                      </div>
                    </div>
                    {localValidationError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {localValidationError}
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium mb-2 flex items-center gap-2">
                        技能名称 <span className="text-[hsl(var(--muted-foreground))] font-normal">(可选)</span>
                      </label>
                      <input
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        placeholder="留空则使用文件夹名称"
                        className="w-full px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

                {/* ===== 在线搜索标签页 ===== */}
                {activeTab === 'online' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 flex items-center gap-2">
                        搜索技能
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={onlineQuery}
                          onChange={(e) => setOnlineQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchOnline()}
                          placeholder="输入技能名称或关键词搜索"
                          className="flex-1 px-3 sm:px-4 py-3 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                          disabled={searchLoading}
                        />
                        <button
                          onClick={handleSearchOnline}
                          className="px-4 py-3 rounded-lg bg-[hsl(var(--primary))] hover:brightness-[0.9] text-white text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2"
                          disabled={searchLoading}
                        >
                          {searchLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Search size={14} />
                          )}
                          搜索
                        </button>
                      </div>
                    </div>

                    {searchError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {searchError}
                      </div>
                    )}

                    {/* 热门技能 */}
                    {!onlineQuery.trim() && (
                      <div className="space-y-3">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                          热门技能
                        </p>
                        {featuredLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-[hsl(var(--muted-foreground))]" />
                          </div>
                        ) : featuredSkills.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {featuredSkills.map((skill) => (
                              <button
                                key={skill.slug}
                                onClick={() => setDetailSkill(skill)}
                                className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))] transition-all text-left"
                              >
                                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0">
                                  <GitBranch size={14} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{skill.name}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Star size={10} className="text-yellow-500" />
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                      {formatCount(skill.stars)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
                            加载热门技能失败
                          </div>
                        )}
                      </div>
                    )}

                    {/* 搜索结果 */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          找到 {searchResults.length} 个技能
                        </p>
                        {searchResults.map((result, index) => (
                          <button
                            key={index}
                            onClick={() => setDetailSkill(result)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))] transition-all text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{result.name}</div>
                              <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                                {result.source}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                <Star size={12} />
                                {formatCount(result.installs)}
                              </div>
                              <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {!searchLoading && searchResults.length === 0 && onlineQuery.trim() && !searchError && (
                      <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
                        未找到相关技能
                      </div>
                    )}
                  </div>
                )}

                {/* 同步目标 - 仅本地标签页显示（Git 标签页在预览状态中单独显示） */}
                {activeTab === 'local' && (
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] p-3 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">同步到工具</label>
                      {tools.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleAllTools}
                          className="text-xs text-[hsl(var(--primary))] hover:underline flex-shrink-0"
                        >
                          {tools.every(t => syncTargets[t.id]) ? '取消全选' : '全选'}
                        </button>
                      )}
                    </div>
                    {tools.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tools.map(tool => {
                          const enabled = syncTargets[tool.id] ?? false;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => toggleTool(tool.id)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                                enabled
                                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/5]"
                                  : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring))]"
                              }`}
                              disabled={loading}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                                  enabled
                                    ? APP_COLORS[tool.id as keyof typeof APP_COLORS] || "bg-[hsl(var(--foreground))]"
                                    : "bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
                                }`}
                              >
                                {enabled && <Check size={12} className="text-white" />}
                              </div>
                              <span className="text-sm">{tool.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        未检测到已安装的 AI 工具。
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 底部按钮 - 在线详情页隐藏 */}
          {!(activeTab === 'online' && detailSkill) && (
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))/30] flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] active:brightness-[0.9] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))]"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={activeTab === 'online' ? () => {} : activeTab === 'git' ? handleCreateGit : handleCreateLocal}
                disabled={
                  loading || gitScanLoading ||
                  activeTab === 'online' ||
                  (activeTab === 'git' && !gitUrl.trim()) ||
                  (activeTab === 'local' && (!localPath.trim() || !localValid))
                }
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[hsl(var(--primary))] hover:brightness-[0.9] active:brightness-[0.85] text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(loading || gitScanLoading) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : activeTab === 'git' && gitPhase === 'input' ? (
                  <>
                    <Eye size={14} />
                    预览仓库
                  </>
                ) : activeTab === 'online' ? (
                  <>
                    <Search size={14} />
                    选择技能后添加
                  </>
                ) : (
                  <>
                    添加技能
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Git 仓库多技能选择弹窗 */}
      <GitPickModal
        open={showGitPickModal}
        candidates={gitCandidates}
        selected={selectedGitCandidates}
        loading={gitScanLoading}
        onToggle={handleGitCandidateToggle}
        onConfirm={handleGitCandidatesConfirm}
        onCancel={() => setShowGitPickModal(false)}
      />
    </>
  );
}

export default AddSkillModal;
