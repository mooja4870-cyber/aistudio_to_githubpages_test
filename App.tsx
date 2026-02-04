
import React, { useState, useRef } from 'react';
import { ImageStyle, StoryboardItem, Character } from './types';
import { 
  parseScriptToScenes, 
  generateStoryboardImage, 
  analyzeCharacters, 
  generateCharacterProfile 
} from './services/geminiService';

declare const JSZip: any;
declare const saveAs: any;

const App: React.FC = () => {
  const [script, setScript] = useState('');
  const [style, setStyle] = useState<ImageStyle>(ImageStyle.SEMI_REALISTIC_WEBTOON);
  const [count, setCount] = useState(4);
  const [items, setItems] = useState<StoryboardItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingProfiles, setIsGeneratingProfiles] = useState(false);
  const [progress, setProgress] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  
  const stopRef = useRef(false);

  const handleAnalyze = async () => {
    if (!script.trim()) return alert("대본을 입력해주세요.");
    setIsAnalyzing(true);
    setCharacters([]);
    setItems([]);
    
    try {
      const analyzedChars = await analyzeCharacters(script);
      setCharacters(analyzedChars);
    } catch (error) {
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createCharacterProfiles = async () => {
    setIsGeneratingProfiles(true);
    try {
      // 시스템적 수단: 캐릭터 프로필 생성을 병렬로 처리하여 대기 시간 단축
      await Promise.all(characters.map(async (char, i) => {
        try {
          const url = await generateCharacterProfile(char, style);
          setCharacters(prev => {
            const next = [...prev];
            if (next[i]) next[i].referenceImageUrl = url;
            return next;
          });
        } catch (e) {
          console.error(`Profile image generation failed for ${char.name}`);
        }
      }));
    } catch (e) {
      alert("프로필 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingProfiles(false);
    }
  };

  const regenerateProfile = async (index: number) => {
    const updated = [...characters];
    const originalUrl = updated[index].referenceImageUrl;
    updated[index].referenceImageUrl = null;
    setCharacters([...updated]);
    try {
      const url = await generateCharacterProfile(updated[index], style);
      updated[index].referenceImageUrl = url;
    } catch (e) {
      updated[index].referenceImageUrl = originalUrl;
    }
    setCharacters([...updated]);
  };

  const handleUpdateCharacter = (index: number, field: keyof Character, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  const handleGenerate = async () => {
    if (characters.some(c => !c.referenceImageUrl)) {
      return alert("모든 등장인물의 기준 이미지를 먼저 생성해주세요. (동일성 유지 필수 단계)");
    }
    setIsGenerating(true);
    setProgress(0);
    setItems([]);
    stopRef.current = false;

    try {
      const scenes = await parseScriptToScenes(script, characters, count);
      if (stopRef.current) return;

      const initialItems: StoryboardItem[] = scenes.map((s, idx) => ({
        id: `item-${idx}-${Date.now()}`,
        prompt: s,
        originalDescription: s,
        imageUrl: null,
        status: 'pending'
      }));
      setItems(initialItems);

      // 시스템적 수단: 순차 생성이 아닌 병렬(Parallel) 청크 생성을 통해 속도를 2배 이상 향상
      // 한 번에 8개씩 병렬로 생성합니다. (최적화)
      const CHUNK_SIZE = 8;
      for (let i = 0; i < initialItems.length; i += CHUNK_SIZE) {
        if (stopRef.current) break;
        
        const currentChunk = initialItems.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(currentChunk.map(async (item, chunkOffset) => {
          const actualIdx = i + chunkOffset;
          if (stopRef.current) return;

          setItems(prev => {
            const next = [...prev];
            if (next[actualIdx]) next[actualIdx].status = 'generating';
            return next;
          });

          try {
            const url = await generateStoryboardImage(item.prompt, style, characters);
            setItems(prev => {
              const next = [...prev];
              if (next[actualIdx]) {
                next[actualIdx].imageUrl = url;
                next[actualIdx].status = 'completed';
              }
              return next;
            });
          } catch (err) {
            setItems(prev => {
              const next = [...prev];
              if (next[actualIdx]) next[actualIdx].status = 'error';
              return next;
            });
          }
        }));

        setProgress(Math.round((Math.min(i + CHUNK_SIZE, initialItems.length) / initialItems.length) * 100));
      }
    } catch (error) {
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
      stopRef.current = false;
    }
  };

  const handleRegenerateItem = async (index: number) => {
    if (isAnalyzing || isGeneratingProfiles) return;
    
    setItems(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index].status = 'generating';
        next[index].imageUrl = null;
      }
      return next;
    });

    try {
      const currentItem = items[index];
      const url = await generateStoryboardImage(currentItem.prompt, style, characters);
      setItems(prev => {
        const next = [...prev];
        if (next[index]) {
          next[index].imageUrl = url;
          next[index].status = 'completed';
        }
        return next;
      });
    } catch (err) {
      setItems(prev => {
        const next = [...prev];
        if (next[index]) next[index].status = 'error';
        return next;
      });
    }
  };

  const downloadAll = async (list?: StoryboardItem[]) => {
    const zip = new JSZip();
    const targetItems = list || items;
    const completedItems = targetItems.filter(item => item.imageUrl && item.status === 'completed');
    
    if (completedItems.length === 0) {
      if (!list) alert("다운로드할 이미지가 없습니다.");
      return;
    }

    completedItems.forEach((item, index) => {
      const base64Data = item.imageUrl!.split(',')[1];
      zip.file(`scene_${index + 1}.png`, base64Data, { base64: true });
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "storyboard_package.zip");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-black text-indigo-600 tracking-tighter flex items-center gap-2">
            <span className="bg-indigo-600 text-white p-1 rounded">SB</span>
            STORYBOARD AI
          </h1>
          {items.some(i => i.status === 'completed') && (
            <button onClick={() => downloadAll()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold text-sm">일괄 다운로드</button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* STEP 1: Script Input */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white text-xs flex items-center justify-center rounded-full">1</span>
            대본 입력 및 캐릭터 추출
          </h2>
          <textarea 
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="대본을 입력하세요..."
            className="w-full h-32 p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-4 bg-slate-50"
          />
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition disabled:opacity-50"
          >
            {isAnalyzing ? "캐릭터 분석 중..." : "등장인물 분석하기"}
          </button>
        </div>

        {/* STEP 2: Character Editing & Profile Generation */}
        {characters.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white text-xs flex items-center justify-center rounded-full">2</span>
                등장인물 정보 수정 및 기준 이미지 확정
              </h2>
              <button 
                onClick={createCharacterProfiles}
                disabled={isGeneratingProfiles}
                className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1 rounded-full hover:bg-indigo-50 transition"
              >
                {isGeneratingProfiles ? "이미지 생성 중..." : "전체 기준 이미지 생성"}
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">* 캐릭터의 이름, 나이, 외모 특징을 수정할 수 있습니다. 수정 후 이미지를 재생성하여 기준을 확정하세요.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((char, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-24 h-24 bg-white rounded-lg border overflow-hidden flex-shrink-0 relative group shadow-sm">
                    {char.referenceImageUrl ? (
                      <>
                        <img src={char.referenceImageUrl} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => regenerateProfile(i)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[10px] text-white font-bold"
                        >
                          이미지 재생성
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 font-bold text-center p-2">
                        {isGeneratingProfiles ? "생성 중..." : "이미지 필요"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input 
                        className="w-2/3 text-sm font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-500" 
                        value={char.name} 
                        onChange={(e) => handleUpdateCharacter(i, 'name', e.target.value)} 
                        placeholder="이름"
                      />
                      <input 
                        className="w-1/3 text-xs text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-500" 
                        value={char.age} 
                        onChange={(e) => handleUpdateCharacter(i, 'age', e.target.value)} 
                        placeholder="나이"
                      />
                    </div>
                    <textarea 
                      className="w-full text-[10px] text-slate-500 bg-white border border-slate-200 rounded p-2 h-14 outline-none focus:border-indigo-500 resize-none"
                      value={char.appearance}
                      onChange={(e) => handleUpdateCharacter(i, 'appearance', e.target.value)}
                      placeholder="외모 특징 (머리색, 옷차림 등)"
                    />
                  </div>
                </div>
              ))}
            </div>

            <hr className="my-6" />

            {/* Generation Config */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">비주얼 스타일</label>
                <select value={style} onChange={(e) => setStyle(e.target.value as ImageStyle)} className="w-full p-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 transition">
                  {Object.values(ImageStyle).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">장면 생성 수: <span className="text-indigo-600">{count}매</span></label>
                <input type="range" min="4" max="99" value={count} onChange={(e) => setCount(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>4</span>
                  <span>50</span>
                  <span>99</span>
                </div>
              </div>
            </div>

            {isGenerating ? (
              <button 
                onClick={handleStop}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-lg shadow-red-100 flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                이미지 생성 중지 및 지금까지 결과 다운로드
              </button>
            ) : (
              <button 
                onClick={handleGenerate}
                disabled={characters.some(c => !c.referenceImageUrl)}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
              >
                스토리보드 순차 생성 시작
              </button>
            )}
          </div>
        )}

        {/* RESULTS AREA */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-video bg-slate-100 relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt={`Scene ${idx+1}`} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      {item.status === 'generating' ? (
                        <>
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-bold text-indigo-600">SCENE {idx + 1} 그리는 중...</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Waiting for turn</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">SCENE {idx + 1}</div>
                    <div className="flex items-center gap-3">
                      {(item.status === 'completed' || item.status === 'error') && (
                        <button 
                          onClick={() => handleRegenerateItem(idx)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                          title="해당 장면 재생성"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                          재생성
                        </button>
                      )}
                      {item.status === 'completed' && <span className="text-[10px] text-green-500 font-bold">완료</span>}
                      {item.status === 'error' && <span className="text-[10px] text-red-500 font-bold">오류</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.originalDescription}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
