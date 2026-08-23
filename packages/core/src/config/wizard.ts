/**
 * 여행조건 선택 5단계 정의 (제안서 6.2).
 *
 * 화면이 아니라 데이터가 단계를 정의한다. 단계를 추가·삭제하거나 문구를 바꿀 때
 * 컴포넌트를 수정할 필요가 없고, 연구자 화면·로그·CSV 헤더가 같은 정의를 공유한다.
 */

import {
  Armchair,
  Baby,
  CalendarDays,
  Camera,
  Car,
  CarFront,
  Check,
  CircleHelp,
  Footprints,
  Heart,
  HeartHandshake,
  House,
  Landmark,
  Palette,
  Route,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  TrainFront,
  TreePine,
  User,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  Waves,
  type LucideIcon,
} from 'lucide-react';

import {
  COMPANION_LABELS,
  DURATION_LABELS,
  INTEREST_LABELS,
  SPECIAL_NEED_LABELS,
  TRANSPORT_LABELS,
} from '../domain/labels';
import type {
  Companion,
  Duration,
  Interest,
  SpecialNeed,
  Transport,
  TravelConditions,
} from '../domain/types/travel';

export interface WizardOption<TValue extends string> {
  value: TValue;
  label: string;
  /** 선택지 아래에 붙는 짧은 보조 설명. 큰 글씨 모드에서는 숨긴다. */
  hint?: string;
  icon: LucideIcon;
}

interface WizardStepBase {
  id: WizardStepId;
  question: string;
  helper: string;
}

/** 단일 선택 단계 — 값이 하나인 필드에만 붙는다. */
export interface SingleChoiceStep<TField extends SingleChoiceField> extends WizardStepBase {
  kind: 'single';
  field: TField;
  options: readonly WizardOption<TravelConditions[TField]>[];
}

/** 복수 선택 단계 — 배열 필드에만 붙는다. */
export interface MultiChoiceStep<TField extends MultiChoiceField> extends WizardStepBase {
  kind: 'multiple';
  field: TField;
  maxSelections: number;
  /** 이 값을 고르면 나머지 선택이 모두 해제되는 배타 선택지. */
  exclusiveValue?: TravelConditions[TField][number];
  options: readonly WizardOption<TravelConditions[TField][number]>[];
}

type SingleChoiceField = 'companion' | 'duration' | 'transport';
type MultiChoiceField = 'interests' | 'specialNeeds';

export type WizardStepId = SingleChoiceField | MultiChoiceField;

export type WizardStep =
  | SingleChoiceStep<'companion'>
  | SingleChoiceStep<'duration'>
  | SingleChoiceStep<'transport'>
  | MultiChoiceStep<'interests'>
  | MultiChoiceStep<'specialNeeds'>;

const COMPANION_ICONS: Record<Companion, LucideIcon> = {
  solo: User,
  couple: Heart,
  friends: Users,
  child: Baby,
  parents: HeartHandshake,
  group: UsersRound,
};

const DURATION_ICONS: Record<Duration, LucideIcon> = {
  day: Sun,
  oneNight: Sunrise,
  twoNights: Sunset,
  threePlus: CalendarDays,
};

const INTEREST_ICONS: Record<Interest, LucideIcon> = {
  culture: Palette,
  nature: TreePine,
  sea: Waves,
  food: UtensilsCrossed,
  photo: Camera,
  history: Landmark,
  activity: Sparkles,
  rest: Armchair,
};

const TRANSPORT_ICONS: Record<Transport, LucideIcon> = {
  transit: TrainFront,
  ownCar: Car,
  rentalCar: CarFront,
  undecided: CircleHelp,
};

const SPECIAL_NEED_ICONS: Record<SpecialNeed, LucideIcon> = {
  lessWalking: Footprints,
  moreIndoor: House,
  shorterDistance: Route,
  childFriendly: Baby,
  seniorFriendly: HeartHandshake,
  lowerCost: Wallet,
  none: Check,
};

/** 라벨 사전과 아이콘 표를 묶어 선택지를 만든다. 문구는 언제나 labels.ts 가 원본이다. */
function toOptions<TValue extends string>(
  values: readonly TValue[],
  labels: Record<TValue, string>,
  icons: Record<TValue, LucideIcon>,
  hints: Partial<Record<TValue, string>> = {},
): readonly WizardOption<TValue>[] {
  return values.map((value) => ({
    value,
    label: labels[value],
    hint: hints[value],
    icon: icons[value],
  }));
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  {
    id: 'companion',
    kind: 'single',
    field: 'companion',
    question: '누구와 여행하나요?',
    helper: '동행자에 따라 추천 관광지와 이동 난이도가 달라집니다.',
    options: toOptions(
      ['solo', 'couple', 'friends', 'child', 'parents', 'group'],
      COMPANION_LABELS,
      COMPANION_ICONS,
      {
        child: '아이 눈높이 체험 위주',
        parents: '보행부담이 낮은 곳 위주',
      },
    ),
  },
  {
    id: 'duration',
    kind: 'single',
    field: 'duration',
    question: '여행기간은 어떻게 되나요?',
    helper: '기간에 따라 광주와 전남을 어떻게 나눌지 결정합니다.',
    options: toOptions(['day', 'oneNight', 'twoNights', 'threePlus'], DURATION_LABELS, DURATION_ICONS, {
      day: '광주 도심 중심',
      oneNight: '가장 많이 선택하는 일정',
    }),
  },
  {
    id: 'interests',
    kind: 'multiple',
    field: 'interests',
    maxSelections: 3,
    question: '무엇을 좋아하나요?',
    helper: '최대 3개까지 고를 수 있습니다.',
    options: toOptions(
      ['culture', 'nature', 'sea', 'food', 'photo', 'history', 'activity', 'rest'],
      INTEREST_LABELS,
      INTEREST_ICONS,
    ),
  },
  {
    id: 'transport',
    kind: 'single',
    field: 'transport',
    question: '어떻게 이동하나요?',
    helper: '이동수단에 따라 도달 가능한 관광지가 달라집니다.',
    options: toOptions(
      ['transit', 'ownCar', 'rentalCar', 'undecided'],
      TRANSPORT_LABELS,
      TRANSPORT_ICONS,
      { transit: 'KTX·시내버스 기준' },
    ),
  },
  {
    id: 'specialNeeds',
    kind: 'multiple',
    field: 'specialNeeds',
    maxSelections: 3,
    exclusiveValue: 'none',
    question: '특별히 고려할 조건이 있나요?',
    helper: '해당하는 항목을 모두 골라 주세요.',
    options: toOptions(
      [
        'lessWalking',
        'moreIndoor',
        'shorterDistance',
        'childFriendly',
        'seniorFriendly',
        'lowerCost',
        'none',
      ],
      SPECIAL_NEED_LABELS,
      SPECIAL_NEED_ICONS,
    ),
  },
];

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;
