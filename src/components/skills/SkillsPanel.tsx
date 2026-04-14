import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, RefreshCw, Search, Folder, Upload } from 'lucide-react';
import { toast } from 'sonner';
import SkillsList from './SkillsList';
import AddSkillModal from './modals/AddSkillModal';
import ImportModal from './modals/ImportModal';
import BatchSyncModal from './modals/BatchSyncModal';
import type {
  ManagedSkill,
  ToolStatusDto,
  OnboardingPlan,
  ToolOption
} from './types';

function SkillsPanel() {
  const [managedSkills, setManagedSkills] = useState<ManagedSkill[]>([]);
  const [toolStatus, setToolStatus] = useState<ToolStatusDto | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBatchSyncModal, setShowBatchSyncModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncTargets, setSyncTargets] = useState<Record<string, boolean>>({});
  const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadManagedSkills = useCallback(async () => {
    try {
      const result = await invoke<ManagedSkill[]>('get_managed_skills');
      setManagedSkills(result);
    } catch (err) {
      console.warn('Failed to load managed skills:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadToolStatus = useCallback(async () => {
    try {
      const status = await invoke<ToolStatusDto>('get_tool_status');
      setToolStatus(status);

      // Default-select installed tools for sync targets
      const targets: Record<string, boolean> = {};
      for (const t of status) {
        targets[t.tool.id] = t.installed;
      }
      setSyncTargets(targets);
    } catch (err) {
      console.warn('Failed to load tool status:', err);
    }
  }, []);

  const loadPlan = useCallback(async () => {
    try {
      const result = await invoke<OnboardingPlan>('get_onboarding_plan');
      setPlan(result);
    } catch (err) {
      console.warn('Failed to load onboarding plan:', err);
    }
  }, []);

  useEffect(() => {
    loadManagedSkills();
    loadToolStatus();
    loadPlan();
  }, [loadManagedSkills, loadToolStatus, loadPlan]);

  const tools: ToolOption[] = toolStatus
    ?.filter(status => status.installed)
    .map((status) => ({
      id: status.tool.id,
      label: status.tool.display_name
    })) || [];

  const handleSyncTargetChange = useCallback((toolId: string, checked: boolean) => {
    setSyncTargets((prev) => ({
      ...prev,
      [toolId]: checked
    }));
  }, []);

  const handleSelectionChange = useCallback((skillId: string, selected: boolean) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(skillId);
      } else {
        next.delete(skillId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedSkills(new Set(managedSkills.map(s => s.id)));
    } else {
      setSelectedSkills(new Set());
    }
  }, [managedSkills]);

  const handleBatchSync = useCallback(() => {
    if (selectedSkills.size === 0) {
      toast.warning('请先选择要同步的技能');
      return;
    }
    setShowBatchSyncModal(true);
  }, [selectedSkills]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    loadManagedSkills();
    loadToolStatus();
  }, [loadManagedSkills, loadToolStatus]);

  const handleReviewImport = useCallback(async () => {
    if (plan) {
      setShowImportModal(true);
      return;
    }
    await loadPlan();
    if (plan) {
      setShowImportModal(true);
    }
  }, [loadPlan, plan]);

  const handleDeleteSkill = useCallback((skill: ManagedSkill) => {
    setDeleteSkillId(skill.id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteSkillId) return;
    const skill = managedSkills.find(s => s.id === deleteSkillId);
    try {
      toast.info(`正在删除技能: ${skill?.name || deleteSkillId}`);
      await invoke('delete_managed_skill', { skillId: deleteSkillId, skillName: skill?.name || '' });
      toast.success(`技能 "${skill?.name}" 已删除`);
      setDeleteSkillId(null);
      loadManagedSkills();
    } catch (err) {
      toast.error(`删除技能失败: ${err}`);
    }
  }, [deleteSkillId, managedSkills, loadManagedSkills]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 头部 */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-5 border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
              Skills 管理
            </h2>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
              统一管理和同步技能到多个 AI 编程工具
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] active:brightness-[0.9] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))] disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              onClick={handleReviewImport}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[hsl(var(--secondary))] hover:brightness-[0.95] active:brightness-[0.9] text-[hsl(var(--secondary-foreground))] rounded-lg text-sm font-medium transition-all border border-[hsl(var(--border))]"
            >
              <Folder size={16} />
              <span className="hidden sm:inline">导入</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[hsl(var(--primary))] hover:brightness-[0.9] active:brightness-[0.85] text-white rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">添加技能</span>
            </button>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="relative mb-3 sm:mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <input
            type="text"
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
          />
        </div>

        {/* 统计栏 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            总计: {managedSkills.length}
          </span>
          {selectedSkills.size > 0 && (
            <button
              onClick={handleBatchSync}
              className="inline-flex items-center gap-1 px-2 py-1 bg-[hsl(var(--primary))] text-white rounded-md hover:brightness-[0.9] transition-all text-xs font-medium"
            >
              <Upload size={12} />
              <span>批量同步到工具</span>
            </button>
          )}
          {tools.filter(t => syncTargets[t.id]).length > 0 && (
            <span className="text-[hsl(var(--muted-foreground))]">
              已同步到: {tools.filter(t => syncTargets[t.id]).length} 个工具
            </span>
          )}
        </div>
      </div>

      {/* 技能列表 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 sm:py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[hsl(var(--muted-foreground))]">加载中...</div>
          </div>
        ) : (
          <SkillsList
            skills={managedSkills}
            tools={tools}
            selectedSkills={selectedSkills}
            onSelectionChange={handleSelectionChange}
            onSelectAll={handleSelectAll}
            searchQuery={searchQuery}
            onDeleteSkill={handleDeleteSkill}
            onDeleteId={deleteSkillId}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setDeleteSkillId(null)}
            onSkillSync={loadManagedSkills}
          />
        )}
      </div>

      {/* 模态框 */}
      <AddSkillModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        tools={tools}
        syncTargets={syncTargets}
        onSyncTargetChange={handleSyncTargetChange}
        onSkillAdded={loadManagedSkills}
      />
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        plan={plan}
        tools={tools}
        syncTargets={syncTargets}
        onSkillAdded={loadManagedSkills}
      />
      <BatchSyncModal
        open={showBatchSyncModal}
        onClose={() => setShowBatchSyncModal(false)}
        selectedSkills={selectedSkills}
        skills={managedSkills}
        tools={tools}
        onSyncComplete={() => {
          setSelectedSkills(new Set());
          loadManagedSkills();
        }}
      />
    </div>
  );
}

export default SkillsPanel;
