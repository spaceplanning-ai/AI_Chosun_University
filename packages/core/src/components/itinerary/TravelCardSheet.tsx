'use client';

import { useCallback, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import {
  drawTravelCard,
  toTravelCardBlob,
  travelCardFilename,
  TRAVEL_CARD_SIZE,
  type TravelCardItinerary,
} from '../../lib/travelCard';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

/**
 * 이미지 여행카드 시트.
 *
 * 캔버스에 그린 뒤 저장·공유를 제공한다. 키오스크에서는 저장 버튼이 의미가 없으므로
 * (전시 장비에 파일이 쌓일 뿐이다) 모바일에서 주로 쓰이며,
 * 키오스크에서는 미리보기로만 노출해 "휴대폰에서 이렇게 저장된다"를 보여 준다.
 */

export interface TravelCardSheetProps {
  itinerary: TravelCardItinerary | undefined;
  onClose: () => void;
  /** 저장·공유 버튼 노출 여부. 키오스크에서는 끈다. */
  allowExport?: boolean;
}

export function TravelCardSheet({ itinerary, onClose, allowExport = true }: TravelCardSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState<string>();

  /**
   * 그리기는 이펙트가 아니라 ref 콜백에서 한다.
   * 캔버스가 화면에 붙는 시점이 곧 그릴 시점이고, 일정이 바뀌면 콜백 identity 가 바뀌어
   * 자동으로 다시 그려진다. 이펙트 안에서 setState 를 부르면 렌더 연쇄가 생긴다.
   */
  const attachCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (!canvas || !itinerary) return;

      try {
        drawTravelCard(canvas, { itinerary });
        setMessage(undefined);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : '카드를 그리지 못했습니다.');
      }
    },
    [itinerary],
  );

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !itinerary) return;

    try {
      const blob = await toTravelCardBlob(canvas);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = travelCardFilename(itinerary);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('이미지를 저장했습니다.');
    } catch {
      setMessage('저장하지 못했습니다. 화면을 길게 눌러 이미지를 저장해 주세요.');
    }
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !itinerary) return;

    try {
      const blob = await toTravelCardBlob(canvas);
      const file = new File([blob], travelCardFilename(itinerary), { type: 'image/png' });

      // 파일 공유를 지원하지 않는 브라우저에서는 곧바로 저장으로 대체한다.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: itinerary.title });
        return;
      }
      await save();
    } catch {
      setMessage('공유를 완료하지 못했습니다.');
    }
  };

  return (
    <Sheet
      open={itinerary !== undefined}
      onClose={onClose}
      title="이미지 여행카드"
      description="일정을 한 장의 이미지로 저장하거나 공유할 수 있습니다."
      footer={
        allowExport ? (
          <div className="flex flex-wrap gap-sm">
            <Button variant="accent" iconLeft={Share2} onClick={() => void share()}>
              공유하기
            </Button>
            <Button variant="quiet" iconLeft={Download} onClick={() => void save()}>
              이미지로 저장
            </Button>
          </div>
        ) : (
          <p className="text-caption text-content-muted">
            QR로 휴대폰에 옮기면 이 카드를 저장하고 공유할 수 있습니다.
          </p>
        )
      }
    >
      <div className="flex flex-col items-center gap-sm">
        <canvas
          ref={attachCanvas}
          width={TRAVEL_CARD_SIZE.width}
          height={TRAVEL_CARD_SIZE.height}
          // 원본 해상도는 유지하고 표시 크기만 줄인다. 저장 시 선명도가 떨어지지 않게 하기 위함이다.
          className="h-auto w-full max-w-[26rem] rounded-card shadow-raised surface-outline"
          role="img"
          aria-label={itinerary ? `${itinerary.title} 여행카드 이미지` : '여행카드'}
        />
        {message ? (
          <p aria-live="polite" className="text-caption text-content-muted">
            {message}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
