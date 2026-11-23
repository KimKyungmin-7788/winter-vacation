import { COMMON_VOICE } from './voice/common';
import { OBI_VOICE } from './voice/obi';
import { TYCOON_VOICE } from './voice/tycoon';
import { SNOW_VOICE } from './voice/snow';
import { PATROL_VOICE } from './voice/patrol';
import { UI_VOICE } from './voice/ui';

/** 학생에게 보이는 모든 문구. 글과 음성은 같은 키로 짝지어진다. */
export const VOICE = {
  ...COMMON_VOICE,
  ...UI_VOICE,
  ...OBI_VOICE,
  ...TYCOON_VOICE,
  ...SNOW_VOICE,
  ...PATROL_VOICE,
} as const;

export type VoiceKey = Extract<keyof typeof VOICE, string>;
