import { ImageOff } from 'lucide-react';

interface Props {
  /** 카드용(sm) / 상세 페이지용(lg) — 아이콘·글자 크기만 다르다 */
  size?: 'sm' | 'lg';
}

/**
 * 이미지가 아직 없는 상품 자리.
 *
 * 예전에는 카테고리별 이모지를 띄웠는데, 상품마다 다른 그림이 뜨니
 * 목록이 장난감 상자처럼 보였다. 치수 정확성을 파는 사이트에서
 * 그림이 튀어 봐야 득이 없어, 전부 같은 중립 아이콘 하나로 맞춘다.
 */
export default function ImagePlaceholder({ size = 'sm' }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-50">
      <ImageOff
        className={[
          'text-slate-300',
          size === 'lg' ? 'h-8 w-8' : 'h-6 w-6',
        ].join(' ')}
        aria-hidden="true"
      />
      <span
        className={[
          'font-medium text-slate-400',
          size === 'lg' ? 'text-xs' : 'text-[11px]',
        ].join(' ')}
      >
        이미지 준비 중
      </span>
    </div>
  );
}
