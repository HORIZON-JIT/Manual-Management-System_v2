import { WorkInstruction, Step, Condition } from '@/types/instruction';

function esc(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/[[\]{}()]/g, '');
}

function wrapLabel(text: string, maxLength: number): string {
  const chunks: string[] = [];
  let current = '';

  for (const char of text) {
    current += char;
    if (current.length >= maxLength && /[、。・,.\s]/.test(char)) {
      chunks.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.join('<br/>');
}

function stepTitle(stepNum: Map<string, number>, step: Step): string {
  return `${stepNum.get(step.id)}. ${step.title}`;
}

function processLabel(stepNum: Map<string, number>, step: Step): string {
  return `"${esc(wrapLabel(stepTitle(stepNum, step), 18))}"`;
}

function decisionLabel(stepNum: Map<string, number>, step: Step): string {
  return `"${esc(wrapLabel(stepTitle(stepNum, step), 14))}"`;
}

function plainDecisionLabel(text: string): string {
  return `"${esc(wrapLabel(text, 12))}"`;
}

function terminalLabel(text: string): string {
  return `"${esc(text)}"`;
}

function pushHeader(lines: string[]) {
  lines.push('graph TD');
  lines.push('  classDef terminal fill:#F7FBFF,stroke:#4B8CF5,stroke-width:2px,color:#111827,font-size:18px,font-weight:600;');
  lines.push('  classDef process fill:#FFFFFF,stroke:#A3A3A3,stroke-width:1.5px,color:#111827,font-size:16px;');
  lines.push('  classDef decision fill:#FFF8E7,stroke:#E0A100,stroke-width:2px,color:#111827,font-size:16px;');
  lines.push(`  START((${terminalLabel('開始')})):::terminal`);
}

export function buildFlowchartDefinition(instruction: WorkInstruction): string {
  const steps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const conditions = instruction.conditions ?? [];

  if (conditions.length === 0 || steps.length === 0) {
    return buildLinear(steps);
  }

  const condGroupMap = new Map<string, string>();
  const groupConds = new Map<string, Condition[]>();
  for (const c of conditions) {
    const g = c.group || '__default';
    condGroupMap.set(c.id, g);
    if (!groupConds.has(g)) groupConds.set(g, []);
    groupConds.get(g)!.push(c);
  }

  const groupParent = new Map<string, string | undefined>();
  for (const g of instruction.conditionGroups ?? []) {
    groupParent.set(g.id, g.parentConditionId);
  }

  const nestedGroupsByParentCond = new Map<string, string[]>();
  for (const [gid, parentCondId] of groupParent) {
    if (!parentCondId) continue;
    if (!nestedGroupsByParentCond.has(parentCondId)) {
      nestedGroupsByParentCond.set(parentCondId, []);
    }
    nestedGroupsByParentCond.get(parentCondId)!.push(gid);
  }

  const isNestedGroup = (gid: string) => !!groupParent.get(gid);

  const stepNum = new Map<string, number>();
  steps.forEach((s, i) => stepNum.set(s.id, i + 1));

  interface GroupSegment {
    kind: 'group';
    decisionStep?: Step;
    branches: { cond: Condition; steps: Step[] }[];
  }

  type Segment = { kind: 'step'; step: Step } | GroupSegment;

  const segments: Segment[] = [];
  const groupsSeen = new Set<string>();

  for (const step of steps) {
    const gid = step.conditionId ? condGroupMap.get(step.conditionId) : undefined;
    if (!gid) {
      segments.push({ kind: 'step', step });
      continue;
    }
    if (groupsSeen.has(gid)) continue;
    groupsSeen.add(gid);
    if (isNestedGroup(gid)) continue;

    const condsInGroup = groupConds.get(gid) ?? [];
    const branches = condsInGroup.map((c) => ({
      cond: c,
      steps: steps.filter((s) => s.conditionId === c.id),
    }));

    const hasSteps = branches.some((b) => b.steps.length > 0);
    if (!hasSteps) continue;

    let decisionStep: Step | undefined;
    if (segments.length > 0 && segments[segments.length - 1].kind === 'step') {
      decisionStep = (segments.pop() as { kind: 'step'; step: Step }).step;
    }

    segments.push({ kind: 'group', decisionStep, branches });
  }

  const lines: string[] = [];
  pushHeader(lines);

  let nodeCounter = 0;
  let decCounter = 0;
  const nid = new Map<string, string>();

  function nodeId(step: Step): string {
    if (!nid.has(step.id)) nid.set(step.id, `s${nodeCounter++}`);
    return nid.get(step.id)!;
  }

  function processNode(step: Step): string {
    return `${nodeId(step)}(${processLabel(stepNum, step)}):::process`;
  }

  function decisionNode(step: Step): string {
    return `${nodeId(step)}{${decisionLabel(stepNum, step)}}:::decision`;
  }

  function emitBranch(branchSteps: Step[], conditionId: string): { firstNode: string | null; exits: string[] } {
    if (branchSteps.length === 0) return { firstNode: null, exits: [] };

    const childGroupIds = nestedGroupsByParentCond.get(conditionId) ?? [];
    const hasNesting = childGroupIds.length > 0;

    const regularSteps = hasNesting ? branchSteps.slice(0, -1) : branchSteps;
    const nestingStep = hasNesting ? branchSteps[branchSteps.length - 1] : null;

    let firstNode: string | null = null;
    let prev: string | null = null;
    let branchPrevLabel: string | null = null;

    for (const step of regularSteps) {
      const id = nodeId(step);
      const hasJumps = !!(step.jumps && step.jumps.length > 0);

      lines.push(`  ${hasJumps ? decisionNode(step) : processNode(step)}`);
      if (prev) {
        if (branchPrevLabel) {
          lines.push(`  ${prev} -- "${esc(branchPrevLabel)}" --> ${id}`);
          branchPrevLabel = null;
        } else {
          lines.push(`  ${prev} --> ${id}`);
        }
      }
      if (!firstNode) firstNode = id;

      if (hasJumps) {
        for (const jump of step.jumps ?? []) {
          const targetStep = steps.find((t) => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (step.jumpDefaultLabel) {
          branchPrevLabel = step.jumpDefaultLabel;
        }
      }

      prev = id;
    }

    if (nestingStep) {
      const decId = nodeId(nestingStep);
      lines.push(`  ${decisionNode(nestingStep)}`);
      if (prev) lines.push(`  ${prev} --> ${decId}`);
      if (!firstNode) firstNode = decId;

      for (const jump of nestingStep.jumps ?? []) {
        const targetStep = steps.find((t) => t.id === jump.targetStepId);
        if (targetStep) {
          lines.push(`  ${decId} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
        }
      }

      const nestedConds = groupConds.get(childGroupIds[0]) ?? [];
      const allExits: string[] = [];

      for (const nestedCond of nestedConds) {
        const nestedSteps = steps.filter((s) => s.conditionId === nestedCond.id);
        const result = emitBranch(nestedSteps, nestedCond.id);
        if (result.firstNode) {
          lines.push(`  ${decId} -- "${esc(nestedCond.label)}" --> ${result.firstNode}`);
          allExits.push(...result.exits);
        } else {
          allExits.push(decId);
        }
      }

      return { firstNode, exits: allExits.length > 0 ? allExits : [decId] };
    }

    return { firstNode, exits: prev ? [prev] : [] };
  }

  let prev: string[] = ['START'];
  let prevLabel: string | null = null;

  for (const seg of segments) {
    if (seg.kind === 'step') {
      const id = nodeId(seg.step);
      const hasJumps = !!(seg.step.jumps && seg.step.jumps.length > 0);
      lines.push(`  ${hasJumps ? decisionNode(seg.step) : processNode(seg.step)}`);

      if (prevLabel) {
        for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> ${id}`);
        prevLabel = null;
      } else {
        for (const p of prev) lines.push(`  ${p} --> ${id}`);
      }

      if (hasJumps) {
        for (const jump of seg.step.jumps ?? []) {
          const targetStep = steps.find((t) => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (seg.step.jumpDefaultLabel) {
          prevLabel = seg.step.jumpDefaultLabel;
        }
      }

      prev = [id];
      continue;
    }

    let decId: string;
    if (seg.decisionStep) {
      decId = nodeId(seg.decisionStep);
      lines.push(`  ${decisionNode(seg.decisionStep)}`);
    } else {
      decId = `dec${decCounter++}`;
      lines.push(`  ${decId}{${plainDecisionLabel('条件')}}:::decision`);
    }

    if (prevLabel) {
      for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> ${decId}`);
      prevLabel = null;
    } else {
      for (const p of prev) lines.push(`  ${p} --> ${decId}`);
    }

    for (const jump of seg.decisionStep?.jumps ?? []) {
      const targetStep = steps.find((t) => t.id === jump.targetStepId);
      if (targetStep) {
        lines.push(`  ${decId} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
      }
    }

    const allExits: string[] = [];
    for (const branch of seg.branches) {
      const result = emitBranch(branch.steps, branch.cond.id);
      if (result.firstNode) {
        lines.push(`  ${decId} -- "${esc(branch.cond.label)}" --> ${result.firstNode}`);
        allExits.push(...result.exits);
      } else {
        allExits.push(decId);
      }
    }
    prev = allExits.length > 0 ? allExits : [decId];
  }

  lines.push(`  END((${terminalLabel('終了')})):::terminal`);
  if (prevLabel) {
    for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> END`);
  } else {
    for (const p of prev) lines.push(`  ${p} --> END`);
  }

  return lines.join('\n');
}

function buildLinear(steps: Step[]): string {
  const stepNum = new Map<string, number>();
  steps.forEach((s, i) => stepNum.set(s.id, i + 1));

  const lines: string[] = [];
  pushHeader(lines);

  let prev = 'START';
  const stepIdMap = new Map<string, string>();
  steps.forEach((step, i) => stepIdMap.set(step.id, `s${i}`));

  steps.forEach((step, i) => {
    const id = `s${i}`;
    const hasJumps = !!(step.jumps && step.jumps.length > 0);
    if (hasJumps) {
      lines.push(`  ${id}{${decisionLabel(stepNum, step)}}:::decision`);
    } else {
      lines.push(`  ${id}(${processLabel(stepNum, step)}):::process`);
    }

    lines.push(`  ${prev} --> ${id}`);

    if (hasJumps) {
      for (const jump of step.jumps ?? []) {
        const targetId = stepIdMap.get(jump.targetStepId);
        if (targetId) {
          lines.push(`  ${id} -- "${esc(jump.label)}" --> ${targetId}`);
        }
      }

      const nextId = i < steps.length - 1 ? `s${i + 1}` : 'END';
      if (step.jumpDefaultLabel) {
        lines.push(`  ${id} -- "${esc(step.jumpDefaultLabel)}" --> ${nextId}`);
      } else {
        lines.push(`  ${id} --> ${nextId}`);
      }
      prev = '__skip__';
    } else {
      prev = id;
    }
  });

  lines.push(`  END((${terminalLabel('終了')})):::terminal`);
  if (prev !== '__skip__') {
    lines.push(`  ${prev} --> END`);
  }

  return lines.join('\n');
}
