import { WorkInstruction } from '@/types/instruction';

const STORAGE_KEY = 'work_instructions';

function stripSnapshotImages(instruction: WorkInstruction): WorkInstruction {
  if (!instruction.updateHistory) return instruction;
  return {
    ...instruction,
    updateHistory: instruction.updateHistory.map(entry => {
      if (!entry.snapshot) return entry;
      return {
        ...entry,
        snapshot: {
          ...entry.snapshot,
          steps: entry.snapshot.steps.map(step => ({
            ...step,
            imageDataUrls: undefined,
            imageDataUrl: undefined,
          })),
        },
      };
    }),
  };
}

export function getAllInstructions(): WorkInstruction[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data) as WorkInstruction[];
  } catch {
    return [];
  }
}

export function getInstruction(id: string): WorkInstruction | undefined {
  return getAllInstructions().find((inst) => inst.id === id);
}

export function saveInstruction(instruction: WorkInstruction): void {
  const toStore = stripSnapshotImages(instruction);
  let all = getAllInstructions();
  const index = all.findIndex((inst) => inst.id === toStore.id);
  if (index >= 0) {
    all[index] = toStore;
  } else {
    if (toStore.status === 'draft' && toStore.title.trim()) {
      all = all.filter(
        (inst) =>
          !(inst.status === 'draft' && inst.title.trim() === toStore.title.trim() && inst.id !== toStore.id)
      );
    }
    all.push(toStore);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('ストレージの容量が不足しています。不要な手順書を削除するか、画像の数を減らしてください。');
    }
    throw e;
  }
}

export function deleteInstruction(id: string): void {
  const all = getAllInstructions().filter((inst) => inst.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function importInstruction(instruction: WorkInstruction): string {
  const existing = getInstruction(instruction.id);
  if (existing) {
    const newId = crypto.randomUUID();
    const imported = { ...instruction, id: newId };
    saveInstruction(imported);
    return newId;
  }
  saveInstruction(instruction);
  return instruction.id;
}
