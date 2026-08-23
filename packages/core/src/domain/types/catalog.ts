/**
 * 관광지·공식문서 카탈로그 타입.
 * 제안서 8.3(관광지 메타데이터) 및 7.3(공식정보 기반 RAG)에 대응한다.
 */

import type { Companion, Interest } from './travel';

export const REGIONS = ['gwangju', 'jeonnam'] as const;
export type Region = (typeof REGIONS)[number];

export type Setting = 'indoor' | 'outdoor' | 'mixed';

/** 공식문서가 실제로 확인해 주는 정보 항목. 정보 신뢰도 산출의 근거가 된다. */
export const DOCUMENT_FIELDS = [
  'openingHours',
  'address',
  'contact',
  'access',
  'fee',
  'closure',
] as const;
export type DocumentField = (typeof DOCUMENT_FIELDS)[number];

/** 발행기관 유형. 공식기관일수록 신뢰도 가점이 크다. */
export const ISSUER_TYPES = ['government', 'publicAgency', 'tourismOrg', 'facility'] as const;
export type IssuerType = (typeof ISSUER_TYPES)[number];

export interface OfficialDocument {
  id: string;
  title: string;
  /** 출처기관명. 결과화면과 모바일 페이지에 그대로 노출된다. */
  issuer: string;
  issuerType: IssuerType;
  url: string;
  /** 최종 갱신일 (ISO yyyy-mm-dd). 오래된 자료는 신뢰도 감점 대상. */
  updatedAt: string;
  /** 이 문서가 근거를 제공하는 관광지 목록. */
  coversAttractionIds: string[];
  /** 문서가 확인해 주는 정보 항목. */
  fields: DocumentField[];
  /** 검색 색인용 키워드. 오프라인 시연모드의 검색 대상이 된다. */
  keywords: string[];
  excerpt: string;
}

export interface Attraction {
  id: string;
  name: string;
  region: Region;
  /** 시·군·구 단위 소재지. */
  district: string;
  address: string;
  coordinates: { lat: number; lng: number };
  /** 관광유형. 이용자 관심분야와 직접 대응한다. */
  categories: Interest[];
  /** 추천 대상 동행유형. */
  audiences: Companion[];
  openingHours: { open: string; close: string };
  /** 휴무일 (요일 한글 1자). 비어 있으면 연중무휴. */
  closedDays: string[];
  averageStayMinutes: number;
  setting: Setting;
  /** 이하 지표는 모두 0–100 정규화 값. */
  walkingLoad: number;
  familyScore: number;
  seniorScore: number;
  rainySuitability: number;
  transitAccess: number;
  costLevel: number;
  /** 인접 관광지. 이동 효율과 연계지수 산출에 쓰인다. */
  adjacentIds: string[];
  summary: string;
  /** 카드에 노출되는 한 줄 특징. */
  highlight: string;
  /** 대표 문구를 그래픽으로 대체하기 위한 시각 모티프. */
  motif: AttractionMotif;
}

/**
 * 전시장 화면은 사진 라이선스 확보 전에도 시연되어야 하므로,
 * 관광지마다 사진 대신 결정적으로 렌더링되는 시각 모티프를 지정한다.
 */
export const ATTRACTION_MOTIFS = [
  'city',
  'art',
  'forest',
  'sea',
  'field',
  'heritage',
  'food',
  'night',
] as const;
export type AttractionMotif = (typeof ATTRACTION_MOTIFS)[number];
