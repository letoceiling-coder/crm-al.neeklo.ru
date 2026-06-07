import { WorkflowStepType } from '@prisma/client';

export type WorkflowStepRow = {
  id: string;
  stepKey: string;
  stepType: WorkflowStepType;
  configuration: unknown;
  position: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  condition?: 'true' | 'false' | 'default';
};

export type GraphDefinition = {
  steps?: string[];
  edges?: GraphEdge[];
};

export type ExecutionCheckpoint = {
  context: Record<string, unknown>;
  nextStepKeys: string[];
  visitedStepKeys: string[];
  skipRemaining?: boolean;
};

export type StepExecutionResult = {
  output: Record<string, unknown>;
  skipRemaining?: boolean;
  asyncWait?: boolean;
  waitMs?: number;
  nextStepKeys?: string[];
};

const SYNC_WAIT_CAP_MS = 30000;

export class WorkflowGraphEngine {
  static syncWaitCapMs = SYNC_WAIT_CAP_MS;

  buildLinearEdges(steps: WorkflowStepRow[]): GraphEdge[] {
    const sorted = [...steps].sort((a, b) => a.position - b.position);
    const edges: GraphEdge[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({ from: sorted[i].stepKey, to: sorted[i + 1].stepKey, condition: 'default' });
    }
    return edges;
  }

  parseDefinition(raw: unknown, steps: WorkflowStepRow[]): GraphDefinition {
    const def = (raw ?? {}) as GraphDefinition;
    return {
      steps: def.steps?.length ? def.steps : steps.map((s) => s.stepKey),
      edges: def.edges?.length ? def.edges : this.buildLinearEdges(steps),
    };
  }

  getStartStepKey(steps: WorkflowStepRow[], definition: GraphDefinition): string {
    const start = steps.find((s) => s.stepType === WorkflowStepType.START);
    if (start) return start.stepKey;
    const sorted = [...steps].sort((a, b) => a.position - b.position);
    return definition.steps?.[0] ?? sorted[0]?.stepKey ?? 'start';
  }

  resolveNextStepKeys(
    currentStep: WorkflowStepRow,
    result: StepExecutionResult,
    definition: GraphDefinition,
  ): string[] {
    if (currentStep.stepType === WorkflowStepType.END) return [];
    if (result.nextStepKeys?.length) return result.nextStepKeys;

    const config = (currentStep.configuration ?? {}) as Record<string, unknown>;

    if (config.parallelTargets && Array.isArray(config.parallelTargets)) {
      const join = String(config.joinStepKey ?? '');
      const targets = config.parallelTargets as string[];
      return join ? [...targets, join] : targets;
    }

    if (currentStep.stepType === WorkflowStepType.BRANCH) {
      const key = String(result.output.nextStepKey ?? '');
      return key ? [key] : [];
    }

    const edges = definition.edges ?? [];
    const outgoing = edges.filter((e) => e.from === currentStep.stepKey);
    if (outgoing.length === 0) return [];
    if (outgoing.length === 1) return [outgoing[0].to];

    if (currentStep.stepType === WorkflowStepType.CONDITION) {
      const branch = result.output.passed ? 'true' : 'false';
      const matched = outgoing.find((e) => e.condition === branch);
      if (matched) return [matched.to];
    }

    const defaults = outgoing.filter((e) => !e.condition || e.condition === 'default');
    return defaults.length ? defaults.map((e) => e.to) : [outgoing[0].to];
  }

  computeWaitMs(config: Record<string, unknown>): number {
    const seconds = Number(config.seconds ?? 0);
    const minutes = Number(config.minutes ?? 0);
    const hours = Number(config.hours ?? 0);
    return (seconds + minutes * 60 + hours * 3600) * 1000;
  }
}
