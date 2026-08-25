'use client';

import { useCallback, useState } from 'react';
import { ArrowRight, ChevronRight, Info } from 'lucide-react';
import { GWANGJU_DISTRICTS, districtAttractions } from '@namdo-prism/core/data';
import { Button } from '@namdo-prism/core/ui';
import { MAP_TILE_URL } from '@/config/runtime';
import { GwangjuDistrictMap, OpenRegionMap } from '@namdo-prism/core/ui/map';

/**
 * 대기화면 (제안서 6.1).
 *
 * 관공서·금융권 안내 키오스크의 층별 안내도 형식을 따랐다.
 * 왼쪽에 광주·전남 광역 안내도를 두고, 오른쪽에 광주 자치구 목록을 세로로 세운다.
 * 지도의 도형과 오른쪽 목록은 **같은 것을 가리키는 두 개의 입구**이므로,
 * 어느 쪽을 눌러도 같은 것이 선택된다 — 손이 닿는 위치가 사람마다 다르기 때문이다.
 *
 * 화면 제목과 로고는 쉘(`KioskShell`) 머리말이 이미 갖고 있다. 여기서 또 제목을 달면
 * 머리말이 두 겹으로 쌓여 정작 눌러야 할 안내도가 밀려난다. 그래서 이 화면은
 * **머리말 없이 안내도로 바로 시작**하고, 남는 높이를 지도가 전부 가져간다.
 */

export interface AttractScreenProps {
  onStart: () => void;
}

export function AttractScreen({ onStart }: AttractScreenProps) {
  const [selectedId, setSelectedId] = useState<string>();
  /*
    실제 지도는 바탕 타일을 받아 와야 그려진다. 전시장 네트워크가 막히면 못 받는다.
    그때는 손으로 그린 안내도로 되돌린다 — 자료가 이미 손에 있어 인터넷과 무관하게 그려진다.

    처음부터 실제 지도로 시작하는 이유는, 이제 «키가 맞는가»를 기다릴 일이 없기 때문이다.
    열린 지도는 열쇠도 도메인 등록도 없어 곧바로 요청이 나간다.
  */
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const handleUnavailable = useCallback(() => setMapUnavailable(true), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-md lg:flex-row lg:items-stretch">
      {/* ── 왼쪽: 큰 문장 + 자치구 안내도. 남는 높이를 지도가 가져간다. ─── */}
      <section className="flex min-h-0 flex-1 flex-col">
        {/*
          멀리서 읽히는 한 문장.

          전시장에서는 화면 앞에 서기 전에 «저게 뭐 하는 물건인가»가 먼저 정해진다.
          지도만 있으면 안내판으로 보이고, 지나친다. 문장이 먼저 붙잡고 지도가 설명한다.
          두 줄로 못 박아 둔 이유는, 폭에 따라 세 줄로 접히면 아래 지도가 그만큼 눌리기 때문이다.
        */}
        <header className="shrink-0 px-xs pt-2xs pb-md">
          <h1 className="text-display font-bold text-content">
            남도의 하루를
            <br />
            AI 가 짜 드립니다
          </h1>
          <p className="mt-sm text-subhead text-content-muted">
            동행 · 기간 · 관심사를 고르면 공식자료를 근거로 일정을 만들어 드립니다
          </p>
        </header>

        <div className="min-h-0 flex-1">
          {/*
            `h-full` 로 두어야 남는 높이를 지도가 채운다.
            `h-auto` 는 폭에서 높이를 정하므로, 화면이 세로로 길면 아래가 통째로 빈다.
          */}
          {mapUnavailable ? (
            <GwangjuDistrictMap
              selectedId={selectedId}
              onSelect={(district) => setSelectedId(district.id)}
              className="h-full w-full"
            />
          ) : (
            <OpenRegionMap
              selectedId={selectedId}
              onSelect={(area) => setSelectedId(area.code)}
              onUnavailable={handleUnavailable}
              tileUrl={MAP_TILE_URL}
              className="h-full w-full"
            />
          )}
        </div>

        <p className="mt-xs flex items-center justify-center gap-xs text-micro text-content-subtle">
          <Info className="size-[1.1em] shrink-0" aria-hidden />
          {mapUnavailable
            ? '통계청 시군구 경계 자료 기준입니다. (오프라인 안내도)'
            : 'OpenStreetMap · 통계청 시군구 경계 자료'}
        </p>
      </section>

      {/* ── 오른쪽: 자치구 목록 ───────────────────────────────────── */}
      <nav
        aria-label="자치구 목록"
        className="flex min-h-0 shrink-0 flex-col gap-2xs lg:w-[24rem]"
      >
        <p className="px-2xs pb-2xs text-caption font-semibold tracking-wide text-content-subtle">
          자치구 안내
        </p>

        <ul className="grid grid-cols-2 gap-2xs lg:grid-cols-1">
          {GWANGJU_DISTRICTS.map((district) => {
            const isSelected = district.id === selectedId;
            const count = districtAttractions(district).length;

            return (
              <li key={district.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(district.id)}
                  className={[
                    'flex min-h-control-lg w-full items-center justify-between gap-sm rounded-control px-md text-left',
                    'transition-colors duration-(--motion-fast)',
                    // 선택 표시는 지도 도형과 같은 강조색을 쓴다. 색이 다르면 서로 다른 것을 가리킨다고 읽힌다.
                    isSelected
                      ? 'district-selected shadow-card'
                      : 'bg-surface-card text-content shadow-card',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block text-label font-bold">{district.name}</span>
                    <span
                      className={[
                        'hide-in-large-mode block text-micro',
                        isSelected ? 'opacity-80' : 'text-content-muted',
                      ].join(' ')}
                    >
                      {district.englishName}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-xs">
                    <span className="text-caption font-semibold tabular-nums">{count}곳</span>
                    {/* 눌러서 들어가는 자리임을 형태로 알린다. 색만으로는 멀리서 보이지 않는다. */}
                    <ChevronRight
                      className={[
                        'size-[1.1em]',
                        isSelected ? 'opacity-70' : 'text-content-subtle',
                      ].join(' ')}
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* 선택한 구의 안내는 지도 위 말풍선이 맡는다. 같은 내용을 옆에 또 두면 눈이 두 번 움직인다. */}
        <div className="flex-1" />

        {/*
          한 줄로 읽혀야 하는 문구다. 폭이 모자라 「여행일정 / 만들기」로 접히면
          잘린 것처럼 보여 «누르는 것»이라는 인상이 약해진다.
          줄바꿈을 막고, 대신 오른쪽 레일 폭을 이 버튼이 들어갈 만큼 잡았다.
        */}
        <Button
          size="lg"
          variant="accent"
          iconRight={ArrowRight}
          onClick={onStart}
          className="mt-xs w-full whitespace-nowrap"
        >
          여행일정 만들기
        </Button>
      </nav>
    </div>
  );
}
