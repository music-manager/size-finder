/**
 * 사진 파일을 카드 표시에 맞게 줄여 data URL 로 바꾼다.
 * 정적 사이트라 업로드할 서버가 없어서, 줄인 이미지를 데이터에 직접 담는다.
 * 원본을 그대로 넣으면 데이터가 수 MB 로 불어나므로 반드시 축소한다.
 */
export const MAX_IMAGE_EDGE = 640;
export const MAX_IMAGE_BYTES = 150 * 1024;

export interface ShrunkImage {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
}

export async function shrinkImageFile(file: File): Promise<ShrunkImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있습니다.');
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 변환할 수 없습니다.');
  // 상품 사진은 흰 배경이 많아 투명 영역을 흰색으로 채운다
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  // 화질을 낮춰가며 용량 한도 안에 들어오는 결과를 고른다
  let dataUrl = '';
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    dataUrl = canvas.toDataURL('image/webp', quality);
    if (dataUrlBytes(dataUrl) <= MAX_IMAGE_BYTES) break;
  }

  return { dataUrl, bytes: dataUrlBytes(dataUrl), width, height };
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((base64.length * 3) / 4);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // createImageBitmap 을 지원하지 않는 브라우저 폴백
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = url;
  });
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.round(bytes / 1024)}KB`;
}
