
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ImageStyle, Character } from "../types";
import { STYLE_PROMPTS, GLOBAL_CONSTRAINTS } from "../constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeCharacters = async (script: string): Promise<Character[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
                appearance: { type: Type.STRING }
              },
              required: ["name", "age", "gender", "appearance"]
            }
          }
        },
        required: ["characters"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"characters": []}');
    return data.characters;
  } catch (e) {
    return [];
  }
};

/**
 * 캐릭터의 기준 프로필 이미지를 생성합니다. (동일성 유지의 핵심)
 */
export const generateCharacterProfile = async (character: Character, style: ImageStyle): Promise<string> => {
  const ai = getAI();
  const stylePrefix = STYLE_PROMPTS[style];
  // 시스템적 속도 향상을 위한 저화질/고속 모드 프롬프트 추가 (실사판 제외)
  const speedHint = style !== ImageStyle.REALISTIC ? " [SYSTEM_OPTIMIZATION: Generate in low-resolution 0.25K quality, simplified draft rendering for maximum speed]" : "";
  const prompt = `${stylePrefix}${speedHint} A professional character concept art portrait of ${character.name}, a ${character.age} year old ${character.gender}. Physical traits: ${character.appearance}. Front facing, neutral background, centered, full face visible. ${GLOBAL_CONSTRAINTS}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) throw new Error("Profile image generation failed");

  return `data:image/png;base64,${part.inlineData.data}`;
};

export const parseScriptToScenes = async (script: string, characters: Character[], count: number): Promise<string[]> => {
  const ai = getAI();
  const charContext = characters.map(c => `${c.name} (${c.age} ${c.gender}): ${c.appearance}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
          scenes: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["scenes"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"scenes": []}');
    return data.scenes.slice(0, count);
  } catch (e) {
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
  const ai = getAI();
  const stylePrefix = STYLE_PROMPTS[style];
  // 시스템적 속도 향상을 위한 저화질/고속 모드 프롬프트 추가 (실사판 제외)
  const speedHint = style !== ImageStyle.REALISTIC ? " [SPEED_PRIORITY: Generate at 0.25K low resolution, simplified textures, fastest processing mode]" : "";
  
  // 이미지 참조 파트 구성
  const parts: any[] = [];
  
  // 1. 캐릭터 프로필 이미지들을 시각적 참조로 추가
  characters.forEach(char => {
    if (char.referenceImageUrl) {
      const base64Data = char.referenceImageUrl.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64Data
        }
      });
      parts.push({ text: `This image above is the visual reference for the character: ${char.name}. Maintain strict visual consistency for this character in the scene below.` });
    }
  });

  // 2. 최종 장면 프롬프트 추가
  const fullPrompt = `${stylePrefix}${speedHint} Scene: ${sceneDescription}. 
  INSTRUCTION: Use the provided character portrait images as strict visual references for their appearance, age, gender, and features. 
  Ensure characters in this scene look exactly like the reference images provided. 
  ${GLOBAL_CONSTRAINTS}`;
  
  parts.push({ text: fullPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (!part || !part.inlineData) throw new Error("Scene generation failed");

  return `data:image/png;base64,${part.inlineData.data}`;
};
