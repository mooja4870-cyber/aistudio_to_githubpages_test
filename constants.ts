
import { ImageStyle } from './types';

export const STYLE_PROMPTS: Record<ImageStyle, string> = {
  [ImageStyle.REALISTIC]: "Photorealistic cinematic photography, high detail, 8k, professional lighting, natural textures, lifelike features.",
  [ImageStyle.CUTE]: "Chibi style art, adorable aesthetic, very large expressive eyes, big head, cute facial expressions, vibrant colors, soft lighting, 3D render feel.",
  [ImageStyle.WEBTOON]: "Modern Korean webtoon manhwa style, clean line art, digital cel shading, trendy character design, bright and sharp colors.",
  [ImageStyle.FLAT_VECTOR]: "Minimalist flat vector illustration, 2D graphic design, bold solid colors, clean geometric shapes, modern startup aesthetic.",
  [ImageStyle.CINEMATIC]: "Cinematic movie still, 35mm lens, dramatic lighting, moody atmosphere, depth of field, high-end film grain, epic composition.",
  [ImageStyle.ANIMATION_3D]: "3D animation style, Pixar and Disney inspired, high quality 3D render, subsurface scattering, soft professional studio lighting, expressive character faces.",
  [ImageStyle.CYBERPUNK]: "Cyberpunk aesthetic, neon lights, futuristic city background, vibrant purple and blue tones, high tech details, dark moody atmosphere.",
  [ImageStyle.RETRO_90S]: "90s retro anime style, VHS aesthetic, slight film grain, nostalgic colors, classic hand-drawn look, lo-fi vibe.",
  [ImageStyle.WATERCOLOR]: "Ethereal watercolor painting, soft pigment bleeding, artistic brush strokes, delicate textures, dreamlike atmosphere, pastel color palette.",
  [ImageStyle.SKETCH]: "Professional pencil sketch, charcoal textures, detailed line work, artistic shading, hand-drawn on paper texture, minimalist but expressive.",
  [ImageStyle.THICK_LINE_ANIME]: "Modern anime illustration with extremely thick bold black outlines, prominent line art with at least 1mm visual thickness, high contrast cel shading, flat vibrant colors, sharp edges, pop art influence.",
  [ImageStyle.SEMI_REALISTIC_WEBTOON]: "High-end semi-realistic Korean webtoon style, detailed facial features with natural proportions, soft realistic lighting, clean refined line art, professional digital painting with subtle gradients, cinematic atmosphere, blend of 3D-like depth and 2D aesthetic."
};

export const GLOBAL_CONSTRAINTS = "Strictly use modern Korean faces and modern casual clothing. DO NOT use Hanbok or traditional Korean clothes unless specifically mentioned as a wedding or funeral. DO NOT include any Korean text or characters in the image unless specifically required by the script. Aspect ratio is 16:9.";
