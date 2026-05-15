export interface CheckItem {
  id: string;
  label: string;
}

export interface Condition {
  id: string;
  label: string;
}

export interface Step {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  /** @deprecated Use imageDataUrls instead */
  imageDataUrl?: string;
  imageDataUrls?: string[];
  imageCaptions?: string[];
  videoUrl?: string;
  caution?: string;
  checkItems?: CheckItem[];
  conditionId?: string;
}

/** Get all image data URLs for a step (handles legacy single-image field) */
export function getStepImages(step: Step): string[] {
  if (step.imageDataUrls && step.imageDataUrls.length > 0) return step.imageDataUrls;
  if (step.imageDataUrl) return [step.imageDataUrl];
  return [];
}

/** Get caption for image at index */
export function getImageCaption(step: Step, index: number): string {
  return step.imageCaptions?.[index] ?? '';
}

export type Category = string;

export const DEFAULT_CATEGORIES = ['事務作業', '現場作業'] as const;

export interface InstructionSnapshot {
  title: string;
  category: Category;
  description: string;
  steps: Step[];
  keywords?: string[];
  createdBy?: string;
}

export interface UpdateHistoryEntry {
  updatedBy: string;
  updatedAt: string;
  note?: string;
  snapshot?: InstructionSnapshot;
}

export type InstructionStatus = 'draft' | 'completed';

export interface WorkInstruction {
  id: string;
  title: string;
  category: Category;
  description: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  updateHistory?: UpdateHistoryEntry[];
  status?: InstructionStatus;
  keywords?: string[];
  driveFileId?: string;
  conditions?: Condition[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  pc_work: 'PC事務作業',
  packing: '梱包作業',
  事務作業: '事務作業',
  現場作業: '現場作業',
};

/** Get display label for a category (falls back to the raw value for custom categories) */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
