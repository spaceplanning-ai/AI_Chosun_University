/**
 * 대표 시연 시나리오 (제안서 11.5).
 *
 * 전시 현장에서 관람객이 직접 5단계를 누를 시간이 없을 때, 진행자가 한 번의 터치로
 * 조건 입력을 건너뛰고 결과화면까지 도달하기 위한 프리셋이다.
 * 검수 항목 "대표 시나리오 4종 정상 작동"(제안서 17.2)의 대상이기도 하다.
 */

import type { RefinementId } from '../domain/types/replan';
import type { TravelConditions } from '../domain/types/travel';

export interface DemoScenario {
  id: string;
  title: string;
  /** 진행자가 관람객에게 읽어 주는 한 줄 상황 설명. */
  description: string;
  conditions: TravelConditions;
  /** 이 시나리오에서 이어서 보여 주면 효과적인 재구성 요청. */
  suggestedRefinement: RefinementId;
  /** 이 시나리오로 무엇을 보여 주려는지. 진행자 화면에만 표시된다. */
  demonstrationPoint: string;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: 'parents-one-night',
    title: '부모님과 1박 2일',
    description: '서울에서 출발해 부모님과 함께, 걷는 시간은 적게.',
    conditions: {
      companion: 'parents',
      duration: 'oneNight',
      interests: ['food', 'nature', 'culture'],
      transport: 'transit',
      specialNeeds: ['lessWalking', 'seniorFriendly'],
      origin: '서울역',
    },
    suggestedRefinement: 'reduceWalking',
    demonstrationPoint:
      '보행부담 조건이 후보 선정과 제외 사유에 어떻게 반영되는지, 그리고 재구성 요청 시 유지 장소와 변경 장소가 어떻게 갈리는지 보여 준다.',
  },
  {
    id: 'couple-emotional',
    title: '연인과 감성여행',
    description: '수도권 출발, 2박 3일, 사진과 바다 중심.',
    conditions: {
      companion: 'couple',
      duration: 'twoNights',
      interests: ['photo', 'sea', 'culture'],
      transport: 'rentalCar',
      specialNeeds: ['none'],
      origin: '용산역',
    },
    suggestedRefinement: 'includeSea',
    demonstrationPoint:
      '기간이 길어질수록 광주–전남 연계지수가 어떻게 올라가는지, 이동수단이 렌터카일 때 접근성 점수가 낮은 섬 자원까지 후보에 들어오는지 보여 준다.',
  },
  {
    id: 'family-with-child',
    title: '아이와 가족여행',
    description: '아이와 함께 1박 2일, 실내 장소 포함 필요.',
    conditions: {
      companion: 'child',
      duration: 'oneNight',
      interests: ['activity', 'nature', 'food'],
      transport: 'ownCar',
      specialNeeds: ['childFriendly', 'moreIndoor'],
      origin: '서울역',
    },
    suggestedRefinement: 'preferIndoor',
    demonstrationPoint:
      '아동 동반 조건이 가족 적합도 점수를 통해 후보 순위를 바꾸는 과정과, 실내 대안 치환이 실제로 실내 비율을 올리는지 보여 준다.',
  },
  {
    id: 'rainy-day-trip',
    title: '비 오는 날 당일여행',
    description: '당일치기, 실내 중심, 자가용 이동.',
    conditions: {
      companion: 'friends',
      duration: 'day',
      interests: ['culture', 'food', 'history'],
      transport: 'ownCar',
      specialNeeds: ['moreIndoor'],
      origin: '서울역',
    },
    suggestedRefinement: 'reduceWalking',
    demonstrationPoint:
      '우천 적합도가 낮은 실외 자원이 조건 필터 단계에서 제외되고, 그 제외 사유가 연구자 화면과 로그에 그대로 남는 것을 보여 준다.',
  },
];

export const DEFAULT_CONDITIONS: TravelConditions = {
  companion: 'couple',
  duration: 'oneNight',
  interests: [],
  transport: 'transit',
  specialNeeds: [],
  origin: '서울역',
};
