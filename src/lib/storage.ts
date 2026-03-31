import { WorkInstruction } from '@/types/instruction';

const STORAGE_KEY = 'work_instructions';

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
  let all = getAllInstructions();
  const index = all.findIndex((inst) => inst.id === instruction.id);
  if (index >= 0) {
    all[index] = instruction;
  } else {
    // 同タイトルの下書きが既にあれば上書き（量産防止）
    if (instruction.status === 'draft' && instruction.title.trim()) {
      all = all.filter(
        (inst) =>
          !(inst.status === 'draft' && inst.title.trim() === instruction.title.trim() && inst.id !== instruction.id)
      );
    }
    all.push(instruction);
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
