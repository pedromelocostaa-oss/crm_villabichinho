import type { LeadStage } from '../types/lead';
import { STAGE_LABELS, STAGE_COLORS } from '../types/lead';

interface Props {
  stage: LeadStage;
  size?: 'sm' | 'md';
}

export function StageBadge({ stage, size = 'md' }: Props) {
  const base = 'inline-flex items-center rounded-full border font-medium';
  const sz = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`${base} ${sz} ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}
