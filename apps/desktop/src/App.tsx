import { useMemo, useState } from 'react';
import { AI_MEMORY_EXTRACTION_PROMPT, ContextRuntime, ProjectService, WorkflowService, type ProjectSnapshot } from '@brain/core';
import type { AIConversationMemory, AgentMode, Task } from '@brain/domain';

type Section = 'project' | 'workflow' | 'ai';

const now = new Date().toISOString();
const seed: ProjectSnapshot = {
  project: { id: 'project-1', name: 'Demo Project', rootPath: '/demo/project', createdAt: now, updatedAt: now, lastScannedAt: now },
  knowledge: [
    { id: 'k-purpose', projectId: 'project-1', type: 'fact', title: 'Purpose', summary: 'A demo project used to prove the Project Brain product model.', state: 'known', confidence: 1, sourceIds: ['repo'], createdAt: now, updatedAt: now },
    { id: 'k-decision', projectId: 'project-1', type: 'decision', title: 'Local-first MVP', summary: 'The MVP keeps project memory local and exposes bounded context to AI agents.', state: 'user_provided', confidence: 1, sourceIds: ['project-1'], createdAt: now, updatedAt: now },
    { id: 'k-risk', projectId: 'project-1', type: 'risk', title: 'External context incomplete', summary: 'Production infrastructure may exist outside the selected repository.', state: 'external', confidence: 0.7, sourceIds: ['user'], createdAt: now, updatedAt: now }
  ],
  tasks: [
    { id: 'task-1', projectId: 'project-1', title: 'Connect first AI agent', description: 'Expose task-scoped Project Brain context to a compatible agent and collect a safe session outcome.', status: 'in_progress', priority: 'high', createdAt: now, updatedAt: now },
    { id: 'task-2', projectId: 'project-1', title: 'Persist AI memories', description: 'Store safe structured decisions and outcomes without raw transcripts.', status: 'todo', priority: 'medium', createdAt: now, updatedAt: now }
  ],
  claims: [{ id: 'claim-1', projectId: 'project-1', taskId: 'task-1', statement: 'Agent context must be task-scoped.', status: 'supported', sourceId: 'k-decision' }],
  evidence: [{ id: 'ev-1', projectId: 'project-1', taskId: 'task-1', claimId: 'claim-1', type: 'source', reference: 'docs/ARCHITECTURE.md', summary: 'Architecture requires minimum-sufficient context and no raw DB access.', confidence: 0.9, createdAt: now }],
  validation: [{ id: 'val-1', projectId: 'project-1', taskId: 'task-1', command: 'pnpm validate', status: 'unknown', summary: 'Not run yet.', startedAt: now }],
  aiMemories: []
};

const projectService = new ProjectService();
const workflowService = new WorkflowService();
const contextRuntime = new ContextRuntime();

function Badge({ children }: { children: string }) { return <span className="badge">{children}</span>; }

export function App() {
  const [section, setSection] = useState<Section>('project');
  const [snapshot, setSnapshot] = useState(seed);
  const [taskId, setTaskId] = useState(seed.tasks[0].id);
  const [aiTab, setAiTab] = useState<'work'|'agents'|'memories'|'history'>('work');
  const [memoryDraft, setMemoryDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [agentObjective, setAgentObjective] = useState('Continue the selected task using Project Brain context.');
  const [mode, setMode] = useState<AgentMode>('implement');
  const brief = useMemo(() => projectService.buildBrief(snapshot), [snapshot]);
  const selectedTask = snapshot.tasks.find((task) => task.id === taskId) ?? snapshot.tasks[0];
  const detail = useMemo(() => workflowService.getTaskDetail(snapshot, selectedTask.id), [snapshot, selectedTask.id]);
  const context = useMemo(() => contextRuntime.build(snapshot, agentObjective, mode, selectedTask.id), [snapshot, agentObjective, mode, selectedTask.id]);

  const saveMemory = () => {
    const text = memoryDraft.trim();
    if (!text) return;
    const item: AIConversationMemory = {
      id: `memory-${Date.now()}`,
      projectId: snapshot.project.id,
      taskId: selectedTask.id,
      sourceAgent: 'manual',
      title: `AI memory · ${selectedTask.title}`,
      summary: text,
      activeDecisions: [],
      supersededDecisions: [],
      discoveries: [],
      unresolvedQuestions: [],
      nextSteps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setSnapshot((current) => ({ ...current, aiMemories: [item, ...current.aiMemories] }));
    setMemoryDraft('');
    setNotice('AI memory saved locally in the current demo state.');
  };

  return <div className="app-shell">
    <header className="topbar">
      <div><strong>Project Brain</strong><span>Persistent project memory for AI development</span></div>
      <div className="project-name">{snapshot.project.name}</div>
    </header>
    <nav className="primary-nav">
      {(['project','workflow','ai'] as Section[]).map((item) => <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}>{item === 'workflow' ? 'Workflow' : item[0].toUpperCase()+item.slice(1)}</button>)}
    </nav>

    <main>
      {section === 'project' && <section className="page">
        <div className="page-title"><div><h1>Project Brief & Health</h1><p>What Brain currently knows, what is missing, and how reliable the project context is.</p></div><Badge>{`${brief.health.score}% health`}</Badge></div>
        <div className="grid metrics">
          <div className="card"><label>Active tasks</label><strong>{brief.activeTasks.length}</strong></div>
          <div className="card"><label>Decisions</label><strong>{brief.importantDecisions.length}</strong></div>
          <div className="card"><label>Risks</label><strong>{brief.risks.length}</strong></div>
          <div className="card"><label>Validation</label><strong>{brief.health.validation}</strong></div>
        </div>
        <div className="grid two">
          <div className="card"><h2>Project Brief</h2><p>{brief.purpose}</p><h3>Important decisions</h3>{brief.importantDecisions.map((item) => <div className="row" key={item.id}><div><strong>{item.title}</strong><p>{item.summary}</p></div><Badge>{item.state}</Badge></div>)}</div>
          <div className="card"><h2>Project Health Report</h2>{Object.entries({Repository:brief.health.repository,Architecture:brief.health.architecture,Documentation:brief.health.documentation,Tasks:brief.health.tasks,Validation:brief.health.validation,'External context':brief.health.externalContext}).map(([key,value])=><div className="health-row" key={key}><span>{key}</span><Badge>{String(value)}</Badge></div>)}<h3>Warnings</h3>{brief.health.warnings.map((warning)=><p className="warning" key={warning}>{warning}</p>)}</div>
        </div>
      </section>}

      {section === 'workflow' && <section className="page workflow-layout">
        <aside className="card task-list"><h2>Board</h2>{snapshot.tasks.filter(t=>t.status!=='archived').map((task:Task)=><button key={task.id} className={task.id===selectedTask.id?'selected':''} onClick={()=>setTaskId(task.id)}><strong>{task.title}</strong><span>{task.status} · {task.priority}</span></button>)}</aside>
        <div className="task-detail">
          <div className="page-title"><div><h1>{selectedTask.title}</h1><p>{selectedTask.description}</p></div><Badge>{selectedTask.status}</Badge></div>
          <div className="grid two">
            <div className="card"><h2>Memory & Decisions</h2>{detail.memory.length?detail.memory.map(m=><div className="row" key={m.id}><div><strong>{m.title}</strong><p>{m.summary}</p></div><Badge>{m.state}</Badge></div>):<p>No task-linked memory yet.</p>}</div>
            <div className="card"><h2>Claims & Evidence</h2>{detail.claims.map(c=><div className="row" key={c.id}><div><strong>{c.statement}</strong><p>{c.status}</p></div></div>)}{detail.evidence.map(e=><div className="row" key={e.id}><div><strong>{e.type}</strong><p>{e.summary}</p></div><Badge>{Math.round(e.confidence*100)+'%'}</Badge></div>)}</div>
            <div className="card"><h2>Validation</h2>{detail.validation.map(v=><div className="row" key={v.id}><div><strong>{v.command}</strong><p>{v.summary}</p></div><Badge>{v.status}</Badge></div>)}</div>
            <div className="card"><h2>AI-ready context</h2><p>{context.items.length} bounded context item(s) selected.</p>{context.warnings.map(w=><p className="warning" key={w}>{w}</p>)}</div>
          </div>
        </div>
      </section>}

      {section === 'ai' && <section className="page">
        <div className="page-title"><div><h1>AI</h1><p>Generate handoffs, connect agents, and preserve important AI memories.</p></div></div>
        <div className="subnav">{(['work','agents','memories','history'] as const).map(tab=><button className={aiTab===tab?'active':''} key={tab} onClick={()=>setAiTab(tab)}>{tab==='work'?'Work with AI':tab==='memories'?'AI Memories':tab[0].toUpperCase()+tab.slice(1)}</button>)}</div>
        {aiTab==='work' && <div className="grid two"><div className="card"><h2>Work with AI</h2><label>Task</label><select value={selectedTask.id} onChange={e=>setTaskId(e.target.value)}>{snapshot.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><label>Mode</label><select value={mode} onChange={e=>setMode(e.target.value as AgentMode)}>{['implement','debug','review','plan','test','refactor','custom'].map(x=><option key={x}>{x}</option>)}</select><label>Objective</label><textarea value={agentObjective} onChange={e=>setAgentObjective(e.target.value)} /><button className="primary" onClick={()=>setNotice('Direct agent adapter not connected yet. Use the generated handoff or implement an MCP/agent adapter from docs/AGENT_INTEGRATION.md.')}>Start direct session</button></div><div className="card"><h2>Context / Handoff Preview</h2><p>{context.items.length} items selected by the context runtime.</p>{context.items.map(item=><div className="row" key={item.id}><div><strong>{item.kind}</strong><p>{item.summary}</p></div><Badge>{Math.round(item.relevance*100)+'%'}</Badge></div>)}</div></div>}
        {aiTab==='agents' && <div className="card"><h2>Connected Agents</h2><p>This greenfield build exposes the product contract first. Direct integrations should implement MCP or an Agent Adapter and request context through Project Brain instead of reading its database.</p><pre>{`Agent <-> MCP/Adapter <-> Project Brain Context Runtime`}</pre><p>See <code>docs/AGENT_INTEGRATION.md</code>.</p></div>}
        {aiTab==='memories' && <div className="grid two"><div className="card"><h2>1. Ask the AI for a safe memory summary</h2><p>Copy this prompt into the conversation you want to preserve:</p><pre>{AI_MEMORY_EXTRACTION_PROMPT}</pre><button onClick={()=>navigator.clipboard.writeText(AI_MEMORY_EXTRACTION_PROMPT)}>Copy extraction prompt</button></div><div className="card"><h2>2. Save AI Memory</h2><p>Paste the structured result, not the raw transcript.</p><textarea rows={12} value={memoryDraft} onChange={e=>setMemoryDraft(e.target.value)} placeholder="Structured decisions, superseded decisions, discoveries, unresolved questions, next steps..."/><button className="primary" onClick={saveMemory}>Save AI Memory</button></div><div className="card span-two"><h2>Saved AI Memories</h2>{snapshot.aiMemories.length?snapshot.aiMemories.map(m=><div className="row" key={m.id}><div><strong>{m.title}</strong><p>{m.summary}</p></div><Badge>{m.sourceAgent}</Badge></div>):<p>No AI memories saved yet.</p>}</div></div>}
        {aiTab==='history' && <div className="card"><h2>AI History</h2><p>Direct agent sessions and handoff generations will appear here once persistence and agent adapters are wired.</p></div>}
        {notice && <div className="notice">{notice}</div>}
      </section>}
    </main>
  </div>;
}
