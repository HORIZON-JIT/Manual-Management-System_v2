import { WorkInstruction, Step, Condition } from '@/types/instruction';

function esc(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/[[\]{}()]/g, '');
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
    if (parentCondId) {
      if (!nestedGroupsByParentCond.has(parentCondId))
        nestedGroupsByParentCond.set(parentCondId, []);
      nestedGroupsByParentCond.get(parentCondId)!.push(gid);
    }
  }

  const isNestedGroup = (gid: string) => !!groupParent.get(gid);

  const stepNum = new Map<string, number>();
  steps.forEach((s, i) => stepNum.set(s.id, i + 1));

  const lbl = (s: Step) => `"${esc(`${stepNum.get(s.id)}. ${s.title}`)}"`;
  const dlbl = (s: Step) => `"　${esc(`${stepNum.get(s.id)}. ${s.title}`)}　"`;

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
    const branches = condsInGroup.map(c => ({
      cond: c,
      steps: steps.filter(s => s.conditionId === c.id),
    }));

    const hasSteps = branches.some(b => b.steps.length > 0);
    if (!hasSteps) continue;

    let decisionStep: Step | undefined;
    if (segments.length > 0 && segments[segments.length - 1].kind === 'step') {
      decisionStep = (segments.pop() as { kind: 'step'; step: Step }).step;
    }

    segments.push({ kind: 'group', decisionStep, branches });
  }

  const lines: string[] = ['graph TD'];
  let nodeCounter = 0;
  let decCounter = 0;
  const nid = new Map<string, string>();

  function nodeId(s: Step): string {
    if (!nid.has(s.id)) nid.set(s.id, `s${nodeCounter++}`);
    return nid.get(s.id)!;
  }

  function emitBranch(
    branchSteps: Step[],
    conditionId: string,
  ): { firstNode: string | null; exits: string[] } {
    if (branchSteps.length === 0) return { firstNode: null, exits: [] };

    const childGroupIds = nestedGroupsByParentCond.get(conditionId) ?? [];
    const hasNesting = childGroupIds.length > 0;

    const regularSteps = hasNesting ? branchSteps.slice(0, -1) : branchSteps;
    const nestingStep = hasNesting ? branchSteps[branchSteps.length - 1] : null;

    let firstNode: string | null = null;
    let prev: string | null = null;
    let branchPrevLabel: string | null = null;

    for (const s of regularSteps) {
      const id = nodeId(s);
      const hasJumps = s.jumps && s.jumps.length > 0;
      if (hasJumps) {
        lines.push(`  ${id}{${dlbl(s)}}`);
      } else {
        lines.push(`  ${id}[${lbl(s)}]`);
      }
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
        for (const jump of s.jumps!) {
          const targetStep = steps.find(t => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (s.jumpDefaultLabel) {
          branchPrevLabel = s.jumpDefaultLabel;
        }
      }
      prev = id;
    }

    if (nestingStep) {
      const decId = nodeId(nestingStep);
      lines.push(`  ${decId}{${dlbl(nestingStep)}}`);
      if (prev) lines.push(`  ${prev} --> ${decId}`);
      if (!firstNode) firstNode = decId;

      const nestedConds = groupConds.get(childGroupIds[0]) ?? [];
      const allExits: string[] = [];

      for (const nc of nestedConds) {
        const nestedSteps = steps.filter(s => s.conditionId === nc.id);
        const result = emitBranch(nestedSteps, nc.id);
        if (result.firstNode) {
          lines.push(`  ${decId} -- "${esc(nc.label)}" --> ${result.firstNode}`);
          allExits.push(...result.exits);
        } else {
          allExits.push(decId);
        }
      }

      return { firstNode, exits: allExits.length > 0 ? allExits : [decId] };
    }

    return { firstNode, exits: prev ? [prev] : [] };
  }

  lines.push('  START(["　開始　"])');
  let prev: string[] = ['START'];
  let prevLabel: string | null = null;

  for (const seg of segments) {
    if (seg.kind === 'step') {
      const id = nodeId(seg.step);
      const hasJumps = seg.step.jumps && seg.step.jumps.length > 0;
      if (hasJumps) {
        lines.push(`  ${id}{${dlbl(seg.step)}}`);
      } else {
        lines.push(`  ${id}[${lbl(seg.step)}]`);
      }
      if (prevLabel) {
        for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> ${id}`);
        prevLabel = null;
      } else {
        for (const p of prev) lines.push(`  ${p} --> ${id}`);
      }
      if (hasJumps) {
        for (const jump of seg.step.jumps!) {
          const targetStep = steps.find(t => t.id === jump.targetStepId);
          if (targetStep) {
            lines.push(`  ${id} -- "${esc(jump.label)}" --> ${nodeId(targetStep)}`);
          }
        }
        if (seg.step.jumpDefaultLabel) {
          prevLabel = seg.step.jumpDefaultLabel;
        }
      }
      prev = [id];
    } else {
      let decId: string;
      if (seg.decisionStep) {
        decId = nodeId(seg.decisionStep);
        lines.push(`  ${decId}{${dlbl(seg.decisionStep)}}`);
      } else {
        decId = `dec${decCounter++}`;
        lines.push(`  ${decId}{"　条件　"}`);
      }
      if (prevLabel) {
        for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> ${decId}`);
        prevLabel = null;
      } else {
        for (const p of prev) lines.push(`  ${p} --> ${decId}`);
      }

      const allExits: string[] = [];
      for (const br of seg.branches) {
        const result = emitBranch(br.steps, br.cond.id);
        if (result.firstNode) {
          lines.push(`  ${decId} -- "${esc(br.cond.label)}" --> ${result.firstNode}`);
          allExits.push(...result.exits);
        } else {
          allExits.push(decId);
        }
      }
      prev = allExits.length > 0 ? allExits : [decId];
    }
  }

  lines.push('  END(["　終了　"])');
  if (prevLabel) {
    for (const p of prev) lines.push(`  ${p} -- "${esc(prevLabel)}" --> END`);
  } else {
    for (const p of prev) lines.push(`  ${p} --> END`);
  }

  return lines.join('\n');
}

function buildLinear(steps: Step[]): string {
  const lines: string[] = ['graph TD', '  START(["　開始　"])'];
  let prev = 'START';
  const stepIdMap = new Map<string, string>();
  steps.forEach((s, i) => stepIdMap.set(s.id, `s${i}`));

  steps.forEach((s, i) => {
    const id = `s${i}`;
    const hasJumps = s.jumps && s.jumps.length > 0;
    if (hasJumps) {
      lines.push(`  ${id}{"${esc(`${i + 1}. ${s.title}`)}"}`);
    } else {
      lines.push(`  ${id}["${esc(`${i + 1}. ${s.title}`)}"]`);
    }
    lines.push(`  ${prev} --> ${id}`);

    if (hasJumps) {
      for (const jump of s.jumps!) {
        const targetId = stepIdMap.get(jump.targetStepId);
        if (targetId) {
          lines.push(`  ${id} -- "${esc(jump.label)}" --> ${targetId}`);
        }
      }
      const defaultLabel = s.jumpDefaultLabel || '';
      const nextId = i < steps.length - 1 ? `s${i + 1}` : 'END';
      if (defaultLabel) {
        lines.push(`  ${id} -- "${esc(defaultLabel)}" --> ${nextId}`);
      } else {
        lines.push(`  ${id} --> ${nextId}`);
      }
      prev = '__skip__';
    } else {
      prev = id;
    }
  });
  lines.push('  END(["　終了　"])');
  if (prev !== '__skip__') {
    lines.push(`  ${prev} --> END`);
  }
  return lines.join('\n');
}
