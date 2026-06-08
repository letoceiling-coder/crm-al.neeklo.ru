import { SetMetadata } from '@nestjs/common';

export const SKIP_PLAN_ENFORCEMENT_KEY = 'skipPlanEnforcement';
export const SkipPlanEnforcement = () => SetMetadata(SKIP_PLAN_ENFORCEMENT_KEY, true);
