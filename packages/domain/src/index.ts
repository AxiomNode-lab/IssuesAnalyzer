export type KnowledgeState = 'known' | 'verified' | 'inferred' | 'missing' | 'external' | 'user_provided' | 'unverified';
export type KnowledgeType = 'decision' | 'requirement' | 'risk' | 'fact' | 'note' | 'external_context' | 'ai_memory';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type EvidenceType = 'source' | 'implementation' | 'validation' | 'manual_qa' | 'runtime' | 'document';
export type AgentMode = 'implement' | 'debug' | 'review' | 'plan' | 'test' | 'refactor' | 'custom';

export interface Project { id: string; name: string; rootPath: string; createdAt: string; updatedAt: string; lastScannedAt?: string; }
export interface ProjectKnowledge { id: string; projectId: string; type: KnowledgeType; title: string; summary: string; state: KnowledgeState; confidence: number; sourceIds: string[]; supersedesId?: string; createdAt: string; updatedAt: string; }
export interface Task { id: string; projectId: string; title: string; description: string; status: TaskStatus; priority: 'low' | 'medium' | 'high'; sourceId?: string; createdAt: string; updatedAt: string; }
export interface Claim { id: string; projectId: string; taskId?: string; statement: string; status: 'open' | 'supported' | 'contradicted' | 'verified'; sourceId?: string; }
export interface Evidence { id: string; projectId: string; taskId?: string; claimId?: string; type: EvidenceType; reference: string; summary: string; confidence: number; createdAt: string; }
export interface ValidationRun { id: string; projectId: string; taskId?: string; command: string; status: 'passed' | 'failed' | 'running' | 'unknown'; summary: string; startedAt: string; finishedAt?: string; }
export interface AIConversationMemory { id: string; projectId: string; taskId?: string; sourceAgent: string; title: string; summary: string; activeDecisions: string[]; supersededDecisions: Array<{ previous: string; replacement: string }>; discoveries: string[]; unresolvedQuestions: string[]; nextSteps: string[]; createdAt: string; updatedAt: string; }
export interface AgentSession { id: string; projectId: string; taskId?: string; adapterId: string; mode: AgentMode; objective: string; status: 'active' | 'completed' | 'failed' | 'canceled'; suppliedContextIds: string[]; startedAt: string; completedAt?: string; }
export interface TaskDetail { task: Task; memory: ProjectKnowledge[]; claims: Claim[]; evidence: Evidence[]; validation: ValidationRun[]; aiMemories: AIConversationMemory[]; contextWarnings: string[]; }
export interface ProjectHealth { score: number; repository: 'strong'|'partial'|'weak'|'unknown'; architecture: 'strong'|'partial'|'weak'|'unknown'; documentation: 'strong'|'partial'|'weak'|'unknown'; tasks: 'strong'|'partial'|'weak'|'unknown'; validation: 'strong'|'partial'|'weak'|'unknown'; externalContext: 'strong'|'partial'|'weak'|'unknown'; warnings: string[]; }
export interface ProjectBrief { purpose: string; architecture: string[]; importantDecisions: ProjectKnowledge[]; activeTasks: Task[]; risks: ProjectKnowledge[]; health: ProjectHealth; }
