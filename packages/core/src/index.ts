import type { AIConversationMemory, AgentMode, Claim, Evidence, Project, ProjectBrief, ProjectHealth, ProjectKnowledge, Task, TaskDetail, ValidationRun } from '@brain/domain';

export interface ProjectSnapshot {
  project: Project;
  knowledge: ProjectKnowledge[];
  tasks: Task[];
  claims: Claim[];
  evidence: Evidence[];
  validation: ValidationRun[];
  aiMemories: AIConversationMemory[];
}

function level(count: number, goodAt: number): 'strong' | 'partial' | 'weak' | 'unknown' {
  if (count <= 0) return 'unknown';
  if (count >= goodAt) return 'strong';
  return count >= Math.max(1, Math.ceil(goodAt / 2)) ? 'partial' : 'weak';
}

export class ProjectService {
  buildHealth(snapshot: ProjectSnapshot): ProjectHealth {
    const decisions = snapshot.knowledge.filter((item) => item.type === 'decision');
    const docs = snapshot.evidence.filter((item) => item.type === 'document' || item.type === 'source');
    const external = snapshot.knowledge.filter((item) => item.state === 'external' || item.type === 'external_context');
    const failedValidation = snapshot.validation.filter((item) => item.status === 'failed');
    const unknown = snapshot.knowledge.filter((item) => item.state === 'missing' || item.state === 'unverified');
    const dimensions = [
      level(1, 1),
      level(decisions.length, 2),
      level(docs.length, 3),
      level(snapshot.tasks.length, 3),
      snapshot.validation.length === 0 ? 'unknown' : failedValidation.length === 0 ? 'strong' : 'weak',
      external.length > 0 ? 'partial' : 'unknown'
    ] as const;
    const points = { strong: 100, partial: 70, weak: 35, unknown: 50 } as const;
    return {
      score: Math.round(dimensions.reduce((sum, item) => sum + points[item], 0) / dimensions.length),
      repository: snapshot.project.lastScannedAt ? 'strong' : 'partial',
      architecture: level(decisions.length, 2),
      documentation: level(docs.length, 3),
      tasks: level(snapshot.tasks.length, 3),
      validation: snapshot.validation.length === 0 ? 'unknown' : failedValidation.length === 0 ? 'strong' : 'weak',
      externalContext: external.length > 0 ? 'partial' : 'unknown',
      warnings: [
        ...(failedValidation.length ? [`${failedValidation.length} validation run(s) are failing.`] : []),
        ...(unknown.length ? [`${unknown.length} knowledge item(s) still need grounding or completion.`] : []),
        ...(external.length === 0 ? ['External project context has not been established; unknown does not mean absent.'] : [])
      ]
    };
  }

  buildBrief(snapshot: ProjectSnapshot): ProjectBrief {
    const activeTasks = snapshot.tasks.filter((task) => task.status !== 'done' && task.status !== 'archived');
    return {
      purpose: snapshot.knowledge.find((item) => item.type === 'fact')?.summary ?? `Software project ${snapshot.project.name}`,
      architecture: snapshot.knowledge.filter((item) => item.type === 'note' || item.type === 'fact').slice(0, 8).map((item) => item.summary),
      importantDecisions: snapshot.knowledge.filter((item) => item.type === 'decision' && item.state !== 'missing').slice(0, 10),
      activeTasks,
      risks: snapshot.knowledge.filter((item) => item.type === 'risk'),
      health: this.buildHealth(snapshot)
    };
  }
}

export class WorkflowService {
  getTaskDetail(snapshot: ProjectSnapshot, taskId: string): TaskDetail {
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const claims = snapshot.claims.filter((item) => item.taskId === taskId);
    const claimIds = new Set(claims.map((item) => item.id));
    const evidence = snapshot.evidence.filter((item) => item.taskId === taskId || (item.claimId ? claimIds.has(item.claimId) : false));
    const memory = snapshot.knowledge.filter((item) => item.sourceIds.includes(taskId));
    const validation = snapshot.validation.filter((item) => item.taskId === taskId);
    const aiMemories = snapshot.aiMemories.filter((item) => item.taskId === taskId);
    return {
      task,
      memory,
      claims,
      evidence,
      validation,
      aiMemories,
      contextWarnings: [
        ...(task.description.trim() ? [] : ['Task description is missing.']),
        ...(evidence.length ? [] : ['No task-specific evidence is recorded yet.']),
        ...(validation.length ? [] : ['No task-specific validation has been recorded.'])
      ]
    };
  }
}

export interface AgentContextItem { id: string; kind: string; summary: string; required?: boolean; sensitive?: boolean; relevance: number; }
export interface AgentContextPackage { projectId: string; taskId?: string; objective: string; mode: AgentMode; items: AgentContextItem[]; warnings: string[]; }

export class ContextRuntime {
  build(snapshot: ProjectSnapshot, objective: string, mode: AgentMode, taskId?: string, maxItems = 20): AgentContextPackage {
    const detail = taskId ? new WorkflowService().getTaskDetail(snapshot, taskId) : null;
    const candidates: AgentContextItem[] = [
      ...snapshot.knowledge.map((item) => ({ id: item.id, kind: item.type, summary: `${item.title}: ${item.summary}`, relevance: item.state === 'verified' ? 0.95 : item.state === 'known' || item.state === 'user_provided' ? 0.85 : 0.55 })),
      ...(detail ? [{ id: detail.task.id, kind: 'task', summary: `${detail.task.title}: ${detail.task.description}`, relevance: 1, required: true }] : []),
      ...(detail?.claims ?? []).map((item) => ({ id: item.id, kind: 'claim', summary: item.statement, relevance: 0.8 })),
      ...(detail?.evidence ?? []).map((item) => ({ id: item.id, kind: `evidence:${item.type}`, summary: item.summary, relevance: item.confidence })),
      ...(detail?.aiMemories ?? []).map((item) => ({ id: item.id, kind: 'ai_memory', summary: item.summary, relevance: 0.8 }))
    ];
    const items = candidates.filter((item) => !item.sensitive).sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)) || b.relevance - a.relevance).slice(0, Math.max(1, maxItems));
    return { projectId: snapshot.project.id, ...(taskId ? { taskId } : {}), objective, mode, items, warnings: detail?.contextWarnings ?? [] };
  }
}

export const AI_MEMORY_EXTRACTION_PROMPT = `Give me, as structured bullet points, the important conclusions and decisions we reached. Clearly identify decisions that were canceled, superseded, or no longer valid, and state what replaced them. Include important discoveries, unresolved questions, and recommended next steps. Do not include secrets, credentials, raw logs, or irrelevant conversation text.`;

export function createAIMemory(input: Omit<AIConversationMemory, 'id' | 'createdAt' | 'updatedAt'>, id: string, now = new Date().toISOString()): AIConversationMemory {
  return { ...input, id, createdAt: now, updatedAt: now };
}
