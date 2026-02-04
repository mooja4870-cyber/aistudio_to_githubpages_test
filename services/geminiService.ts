// src/services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { ImageStyle, Character } from "../types";
import { STYLE_PROMPTS, GLOBAL_CONSTRAINTS } from "../constants";

// ✅ Vite에서는 process.env가 아니라 import.meta.env를 씁니다.
const getAI = () =>
  new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
  });

// (선택) API 키가 비어있으면 즉시 알려주기 (디버깅용)
const assertApiKey = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!key) {
    throw new Error(
      "VITE_GEMINI_API_KEY가 비어 있습니다. 프로젝트 루트의 .env 파일을 확인하세요."
    );
  }
};

export const analyzeCharacters = async (script: string): Promise<Character[]> => {
  assertApiKey();

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following script and extract the main characters.
For each character, provide: Name, Age, Gender, and a detailed physical Appearance description (hair style/color, facial features, typical build).
All descriptions must be in English.
Script: "${script}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                age: { type: Type.STRING },
                gender: { type: Type.STRING },
                appearance: { type: Type.STRING },
              },
              required: ["name", "age", "gender", "appearance"],
            },
          },
        },
        required: ["characters"],
      },
    },
  });

  try {
    const text =
      (response as any)?.text ??
      (response as any)?.response?.text ??
      (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "";

    const data = JSON.parse(text || '{"characters": []}');
    return data.characters || [];
  } catch {
    return [];
  }
};

/**
 * 캐릭터의 기준 프로필 이미지를 생성합니다. (동일성 유지의 핵심)
 */
export const generateCharacterProfile = async (
  character: Character,
  style: ImageStyle
): Promise<string> => {
  assertApiKey();

  const ai = getAI();
  const stylePrefix = STYLE_PROMPTS[style];

  const speedHint =
    style !== ImageStyle.REALISTIC
      ? " [SYSTEM_OPTIMIZATION: Generate in low-resolution 0.25K quality, simplified draft rendering for maximum speed]"
      : "";

  const prompt = `${stylePrefix}${speedHint} A professional character concept art portrait of ${character.name}, a ${character.age} year old ${character.gender}. Physical traits: ${character.appearance}. Front facing, neutral background, centered, full face visible. ${GLOBAL_CONSTRAINTS}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Profile image generation failed");

  return `data:image/png;base64,${part.inlineData.data}`;
};

export const parseScriptToScenes = async (
  script: string,
  characters: Character[],
  count: number
): Promise<string[]> => {
  assertApiKey();

  const ai = getAI();
  const charContext = characters
    .map((c) => `${c.name} (${c.age} ${c.gender}): ${c.appearance}`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the character definitions, parse the script into exactly ${count} visual scenes.
Refer to characters by name and include their traits.
Descriptions in English.
Characters:
${charContext}
Script: "${script}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["scenes"],
      },
    },
  });

  try {
    const text =
      (response as any)?.text ??
      (response as any)?.response?.text ??
      (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "";

    const data = JSON.parse(text || '{"scenes": []}');
    return (data.scenes || []).slice(0, count);
  } catch {
    return [];
  }
};

/**
 * 캐릭터 프로필 이미지를 시각적 참조 데이터로 사용하여 장면 이미지를 생성합니다.
 */
export const generateStoryboardImage = async (
  sceneDescription: string,
  style: ImageStyle,
  characters: Character[]
): Promise<string> => {
  assertApiKey();

  const ai = getAI();
  const stylePrefix = STYLE_PROMPTS[style];

  const speedHint =
    style !== ImageStyle.REALISTIC
      ? " [SPEED_PRIORITY: Generate at 0.25K low resolution, simplified textures, fastest processing mode]"
      : "";

  const parts: any[] = [];

  // 1) 캐릭터 참조 이미지
  characters.forEach((char) => {
    if (char.referenceImageUrl) {
      const base64Data = char.referenceImageUrl.split(",")[1];
      if (base64Data) {
        parts.push({
          inlineData: { mimeType: "image/png", data: base64Data },
        });
        parts.push({
          text: `This image above is the visual reference for the character: ${char.name}. Maintain strict visual consistency for this character in the scene below.`,
        });
      }
    }
  });

  // 2) 장면 프롬프트
  const fullPrompt = `${stylePrefix}${speedHint} Scene: ${sceneDescription}.
INSTRUCTION: Use the provided character portrait images as strict visual references for their appearance, age, gender, and features.
Ensure characters in this scene look exactly like the reference images provided.
${GLOBAL_CONSTRAINTS}`;

  parts.push({ text: fullPrompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: { parts },
    config: { imageConfig: { aspectRatio: "16:9" } },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Scene generation failed");

  return `data:image/png;base64,${part.inlineData.data}`;
};
