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

  const stepNum = new Map<string, number>();
  steps.forEach((s, i) => stepNum.set(s.id, i + 1));

  const label = (s: Step) => `"${esc(`${stepNum.get(s.id)}. ${s.title}`)}"`;

  type Segment =
    | { kind: 'step'; step: Step }
    | { kind: 'group'; groupId: string; branches: { cond: Condition; steps: Step[] }[] };

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

    const condsInGroup = groupConds.get(gid) ?? [];
    const branches = condsInGroup.map(c => ({
      cond: c,
      steps: steps.filter(s => s.conditionId === c.id),
    }));
    segments.push({ kind: 'group', groupId: gid, branches });
  }

  const lines: string[] = ['graph TD'];
  let nodeCounter = 0;
  let decCounter = 0;
  const nid = new Map<string, string>();

  function nodeId(s: Step): string {
    if (!nid.has(s.id)) nid.set(s.id, `s${nodeCounter++}`);
    return nid.get(s.id)!;
  }

  function declareStep(s: Step): void {
    const id = nodeId(s);
    lines.push(`  ${id}[${label(s)}]`);
  }

  function emitBranchSteps(branchSteps: Step[]): string | null {
    if (branchSteps.length === 0) return null;
    let prev: string | null = null;
    for (const s of branchSteps) {
      declareStep(s);
      const id = nodeId(s);
      if (prev) lines.push(`  ${prev} --> ${id}`);
      prev = id;
    }
    return prev;
  }

  lines.push('  START(["開始"])');
  let prev: string[] = ['START'];

  for (const seg of segments) {
    if (seg.kind === 'step') {
      declareStep(seg.step);
      const id = nodeId(seg.step);
      for (const p of prev) lines.push(`  ${p} --> ${id}`);
      prev = [id];
    } else {
      const decId = `dec${decCounter++}`;
      const groupLabel = seg.groupId === '__default' ? '条件' : seg.groupId;
      lines.push(`  ${decId}{"${esc(groupLabel)}"}`);
      for (const p of prev) lines.push(`  ${p} --> ${decId}`);

      const exits: string[] = [];
      for (const br of seg.branches) {
        const lastId = emitBranchSteps(br.steps);
        if (lastId) {
          lines.push(`  ${decId} -- "${esc(br.cond.label)}" --> ${nodeId(br.steps[0])}`);
          exits.push(lastId);
        } else {
          exits.push(decId);
        }
      }
      prev = exits;
    }
  }

  lines.push('  END(["終了"])');
  for (const p of prev) lines.push(`  ${p} --> END`);

  return lines.join('\n');
}

function buildLinear(steps: Step[]): string {
  const lines: string[] = ['graph TD', '  START(["開始"])'];
  let prev = 'START';
  steps.forEach((s, i) => {
    const id = `s${i}`;
    lines.push(`  ${id}["${esc(`${i + 1}. ${s.title}`)}"]`);
    lines.push(`  ${prev} --> ${id}`);
    prev = id;
  });
  lines.push('  END(["終了"])');
  lines.push(`  ${prev} --> END`);
  return lines.join('\n');
}
