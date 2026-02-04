
export enum ImageStyle {
  REALISTIC = '실사판',
  CUTE = '귀염/뽀짝 (얼굴 부각)',
  WEBTOON = 'K-웹툰',
  FLAT_VECTOR = '플랫벡터',
  CINEMATIC = '시네마',
  ANIMATION_3D = '3D 애니메이션',
  CYBERPUNK = '네온 사이버펑크',
  RETRO_90S = '90년대 레트로',
  WATERCOLOR = '수채화',
  SKETCH = '연필 스케치',
  THICK_LINE_ANIME = '굵은 선 애니',
  SEMI_REALISTIC_WEBTOON = '반실사 웹툰'
}

export interface Character {
  name: string;
  age: string;
  gender: string;
  appearance: string;
  referenceImageUrl?: string | null;
}

export interface StoryboardItem {
  id: string;
  prompt: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'error';
  originalDescription: string;
}

export interface GenerationSettings {
  style: ImageStyle;
  imageCount: number;
}
