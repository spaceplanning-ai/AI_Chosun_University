'use client';

import { ArrowRight, Clock, MapPin, X } from 'lucide-react';
import { areaAttractions, type NamdoArea } from '@namdo-prism/core/data';
import { INTEREST_LABELS } from '@namdo-prism/core/domain';
import { AttractionMotifArt, Badge, Button } from '@namdo-prism/core/ui';

/**
 * 지도에서 고른 구의 관광지 목록 (대기화면).
 *
 * ── 왜 지도 위에 겹치는가 ──────────────────────────────────────────
 * 지도를 옆으로 밀어내고 목록을 나란히 두면, 고른 구가 화면 밖으로 밀려나
 * «내가 어디를 눌렀는지»를 잃는다. 지도는 그 자리에 두고 목록만 위에 얹는다 —
 * 지도 앱들이 모두 이렇게 하는 이유이기도 하다.
 *
 * ── 왜 여기에 시작 단추가 있는가 ───────────────────────────────────
 * 대기화면이 지도 하나가 되면서 «여행일정 만들기»가 갈 곳을 잃었다.
 * 관람객이 어느 구를 눌러 본 그 순간이 가장 관심이 높은 때이므로, 그 자리에 둔다.
 */

export interface DistrictPanelProps {
  district: NamdoArea;
  onClose: () => void;
  onStart: () => void;
}

export function DistrictPanel({ district, onClose, onStart }: DistrictPanelProps) {
  const attractions = areaAttractions(district);

  return (
    <aside
      // 지도 위에 얹히므로 스스로 배경과 그림자를 갖는다.
      className="pointer-events-auto flex h-full w-[26rem] flex-col overflow-hidden rounded-panel bg-surface-card shadow-overlay"
      aria-label={`${district.name} 관광지 목록`}
    >
      <header className="flex items-start justify-between gap-sm border-b border-line-subtle p-lg">
        <div className="min-w-0">
          <p className="flex items-baseline gap-xs">
            <span className="text-title font-bold text-content">{district.name}</span>
            {district.englishName === undefined ? null : (
              <span className="text-caption text-content-subtle">{district.englishName}</span>
            )}
          </p>
          {district.summary === undefined ? null : (
            <p className="mt-xs text-caption leading-relaxed text-content-muted">
              {district.summary}
            </p>
          )}
        </div>

        <Button variant="ghost" size="sm" iconOnly iconLeft={X} onClick={onClose} aria-label="닫기" />
      </header>

      <div className="flex items-center justify-between gap-sm px-lg py-sm">
        <span className="text-caption font-semibold text-content">관광자원</span>
        <Badge tone={attractions.length === 0 ? 'neutral' : 'brand'}>{attractions.length}곳</Badge>
      </div>

      {/* 목록은 길어질 수 있다. 여기만 스크롤하고 아래 단추는 늘 보이게 둔다. */}
      <ul className="scrollable-y flex min-h-0 flex-1 flex-col gap-xs px-lg pb-lg">
        {attractions.length === 0 ? (
          <li className="rounded-card bg-surface-sunken p-md text-caption text-content-muted">
            이 지역에는 아직 등록된 관광자원이 없습니다. 다른 지역을 눌러 보세요.
          </li>
        ) : (
          attractions.map((attraction) => (
            <li
              key={attraction.id}
              className="flex gap-md rounded-card bg-surface-card p-sm shadow-card"
            >
              {/* 사진 대신 모티프 그림. 라이선스 없이도 «무엇인지»가 전달된다. */}
              <AttractionMotifArt
                motif={attraction.motif}
                region={attraction.region}
                className="size-[4.5rem] shrink-0 rounded-card"
              />

              <div className="min-w-0 flex-1">
                <p className="text-label font-bold text-content">{attraction.name}</p>
                <p className="mt-2xs line-clamp-2 text-micro leading-relaxed text-content-muted">
                  {attraction.highlight}
                </p>

                <p className="mt-xs flex flex-wrap items-center gap-x-sm gap-y-2xs text-micro text-content-subtle">
                  <span className="flex items-center gap-2xs">
                    <Clock className="size-[1.1em]" aria-hidden />
                    {attraction.averageStayMinutes}분
                  </span>
                  <span className="flex items-center gap-2xs">
                    <MapPin className="size-[1.1em]" aria-hidden />
                    {attraction.district}
                  </span>
                </p>

                <p className="mt-xs flex flex-wrap gap-2xs">
                  {attraction.categories.map((category) => (
                    <Badge key={category} size="sm" tone="neutral">
                      {INTEREST_LABELS[category]}
                    </Badge>
                  ))}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>

      <footer className="border-t border-line-subtle p-lg">
        <Button
          size="lg"
          variant="accent"
          iconRight={ArrowRight}
          onClick={onStart}
          className="w-full whitespace-nowrap"
        >
          여행일정 만들기
        </Button>
      </footer>
    </aside>
  );
}
