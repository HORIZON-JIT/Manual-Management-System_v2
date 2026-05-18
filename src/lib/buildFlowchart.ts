import { WorkInstruction, Step, Condition, getStepConditionIds } from '@/types/instruction';

function esc(text: string): string {
  return text.replace(/\"/g, '#quot;').replace(/[[\\]{}()]/g, '');
}

function wrapLabel(text: string, maxLength: number): string {
  const chunks: string[] = [];
  let current = '';

  for (const char of text) {
    current += char;
    if (current.length >= maxLength && /[\u3001\u3002\u30fb,.\s]/.test(char)) {
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
  lines.push('  classDef route fill:transparent,stroke:transparent,color:transparent;');
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

  const getStepGroupIds = (step: Step): string[] => {
    const groupIds: string[] = [];
    for (const conditionId of getStepConditionIds(step)) {
      const groupId = condGroupMap.get(conditionId);
      if (groupId && !groupIds.includes(groupId)) groupIds.push(groupId);
    }
    return groupIds;
  };

  const getGroupDepth = (groupId: string, visited = new Set<string>()): number => {
    if (visited.has(groupId)) return 0;
    visited.add(groupId);
    const parentConditionId = groupParent.get(groupId);
    if (!parentConditionId) return 0;
    const parentGroupId = condGroupMap.get(parentConditionId);
    if (!parentGroupId) return 0;
    return getGroupDepth(parentGroupId, visited) + 1;
  };

  const getOwningStepGroupId = (step: Step): string | undefined => {
    const groupIds = getStepGroupIds(step);
    if (groupIds.length === 0) return undefined;

    return [...groupIds].sort((a, b) => {
      const depthDiff = getGroupDepth(b) - getGroupDepth(a);
      if (depthDiff !== 0) return depthDiff;
      return groupIds.indexOf(a) - groupIds.indexOf(b);
    })[0];
  };

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
    const gid = getOwningStepGroupId(step);
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
      steps: steps.filter(
        (s) => getOwningStepGroupId(s) === gid && getStepConditionIds(s).includes(c.id),
      ),
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
  let routeCounter = 0;
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

  function createRouteNode(): string {
    const routeId = `r${routeCounter++}`;
    lines.push(`  ${routeId}[" "]:::route`);
    return routeId;
  }

  function connectManyToOne(fromIds: string[], toId: string, label?: string | null) {
    if (fromIds.length === 0) return;
    if (fromIds.length === 1) {
      if (label) {
        lines.push(`  ${fromIds[0]} -- "${esc(label)}" --> ${toId}`);
      } else {
        lines.push(`  ${fromIds[0]} --> ${toId}`);
      }
      return;
    }

    const routeId = createRouteNode();
    for (const fromId of fromIds) {
      lines.push(`  ${fromId} --> ${routeId}`);
    }
    if (label) {
      lines.push(`  ${routeId} -- "${esc(label)}" --> ${toId}`);
    } else {
      lines.push(`  ${routeId} --> ${toId}`);
    }
  }

  function collapseExits(exits: string[]): string[] {
    if (exits.length <= 1) return exits;
    const routeId = createRouteNode();
    for (const exitId of exits) {
      lines.push(`  ${exitId} --> ${routeId}`);
    }
    return [routeId];
  }

  function emitBranch(branchSteps: Step[], conditionId: string): { firstNode: string | null; exits: string[] } {
    if (branchSteps.length === 0) return { firstNode: null, exits: [] };

    const childGroupIds = nestedGroupsByParentCond.get(conditionId) ?? [];
    const hasNesting = childGroupIds.length > 0;

    const branchCutIndex = branchSteps.findIndex((step) => step.endsBranch);
    const effectiveBranchSteps = branchCutIndex >= 0 ? branchSteps.slice(0, branchCutIndex + 1) : branchSteps;

    const regularSteps = hasNesting ? effectiveBranchSteps.slice(0, -1) : effectiveBranchSteps;
    const nestingStep = hasNesting ? effectiveBranchSteps[effectiveBranchSteps.length - 1] : null;
    const branchEndsHere = !!effectiveBranchSteps[effectiveBranchSteps.length - 1]?.endsBranch;

    let firstNode: string | null = null;
    let prev: string[] = [];
    let branchPrevLabel: string | null = null;

    for (const step of regularSteps) {
      const id = nodeId(step);
      const hasJumps = !!(step.jumps && step.jumps.length > 0);

      lines.push(`  ${hasJumps ? decisionNode(step) : processNode(step)}`);
      if (prev.length > 0) {
        connectManyToOne(prev, id, branchPrevLabel);
        branchPrevLabel = null;
      }
      if (!firstNode) firstNode = id;

      if (hasJumps) {
        for (const jump of step.jumps ?? []) {
          const targetStep = steps.find((t) => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (step.jumpDefaultLabel && !step.endsBranch) {
          branchPrevLabel = step.jumpDefaultLabel;
        }
      }

      prev = [id];
      if (step.endsBranch) {
        return { firstNode, exits: prev };
      }
    }

    if (nestingStep) {
      const decId = nodeId(nestingStep);
      const hasJumps = !!(nestingStep.jumps && nestingStep.jumps.length > 0);
      lines.push(`  ${hasJumps ? decisionNode(nestingStep) : processNode(nestingStep)}`);
      if (prev.length > 0) {
        connectManyToOne(prev, decId, branchPrevLabel);
        branchPrevLabel = null;
      }
      if (!firstNode) firstNode = decId;

      for (const jump of nestingStep.jumps ?? []) {
        const targetStep = steps.find((t) => t.id === jump.targetStepId);
        if (targetStep) {
          lines.push(`  ${decId} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
        }
      }

      if (branchEndsHere) {
        return { firstNode, exits: [decId] };
      }

      const nestedConds = groupConds.get(childGroupIds[0]) ?? [];
      const nestedBranchResults = nestedConds.map((nestedCond) => {
        const nestedSteps = steps.filter(
          (s) => getOwningStepGroupId(s) === childGroupIds[0] && getStepConditionIds(s).includes(nestedCond.id),
        );
        return {
          cond: nestedCond,
          ...emitBranch(nestedSteps, nestedCond.id),
        };
      });

      for (const result of nestedBranchResults) {
        if (result.firstNode) {
          lines.push(`  ${decId} -- "${esc(result.cond.label)}" --> ${result.firstNode}`);
        } else {
          lines.push(`  ${decId} -- "${esc(result.cond.label)}" --> END`);
        }
      }

      return {
        firstNode,
        exits: collapseExits(
          nestedBranchResults.flatMap((result) => result.exits),
        ),
      };
    }

    if (branchEndsHere && prev.length > 0) {
      return { firstNode, exits: prev };
    }

    return { firstNode, exits: prev };
  }

  let prev: string[] = ['START'];
  let prevLabel: string | null = null;

  for (const seg of segments) {
    if (seg.kind === 'step') {
      const id = nodeId(seg.step);
      const hasJumps = !!(seg.step.jumps && seg.step.jumps.length > 0);
      lines.push(`  ${hasJumps ? decisionNode(seg.step) : processNode(seg.step)}`);
      connectManyToOne(prev, id, prevLabel);
      prevLabel = null;

      if (hasJumps) {
        for (const jump of seg.step.jumps ?? []) {
          const targetStep = steps.find((t) => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (seg.step.jumpDefaultLabel && !seg.step.endsBranch) {
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

    connectManyToOne(prev, decId, prevLabel);
    prevLabel = null;

    for (const jump of seg.decisionStep?.jumps ?? []) {
      const targetStep = steps.find((t) => t.id === jump.targetStepId);
      if (targetStep) {
        lines.push(`  ${decId} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
      }
    }

    const branchResults = seg.branches.map((branch) => ({
      cond: branch.cond,
      ...emitBranch(branch.steps, branch.cond.id),
    }));

    for (const result of branchResults) {
      if (result.firstNode) {
        lines.push(`  ${decId} -- "${esc(result.cond.label)}" --> ${result.firstNode}`);
      } else {
        lines.push(`  ${decId} -- "${esc(result.cond.label)}" --> END`);
      }
    }

    prev = collapseExits(branchResults.flatMap((result) => result.exits));
  }

  lines.push(`  END((${terminalLabel('終了')})):::terminal`);
  connectManyToOne(prev, 'END', prevLabel);

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
