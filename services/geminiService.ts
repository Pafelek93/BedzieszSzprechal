
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Challenge, Feedback, Tense, AppMode } from "../types";

// Bezpieczne pobieranie klucza API
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const generateImageForMeme = async (description: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A vibrant, modern internet meme style illustration of: ${description}. Clear, funny, high quality.` }],
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { console.error("Meme image gen failed", e); }
  return undefined;
};

export const generateChallenge = async (
  difficulty: Difficulty, 
  mode: AppMode, 
  masteredItems: string[] = [],
  selectedTense?: Tense
): Promise<Challenge> => {
  const exclusionContext = masteredItems.length > 0 
    ? `\n\nZAKAZ: Nie używaj tych haseł (opanowane): ${masteredItems.slice(-100).join(', ')}.` 
    : '';
  
  if (mode === AppMode.MEMES) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Znajdź popularny, kultowy lub aktualny niemiecki mem internetowy.
      Przygotuj opracowanie dla Polaka uczącego się niemieckiego. 
      Zwróć JSON z polami: memeTitle, memeGermanText, polish, memeExplanation, memeContext, imagePrompt, topic, difficulty: ${difficulty}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            memeTitle: { type: Type.STRING },
            memeGermanText: { type: Type.STRING },
            polish: { type: Type.STRING },
            memeExplanation: { type: Type.STRING },
            memeContext: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING }
          },
          required: ["memeTitle", "memeGermanText", "polish", "memeExplanation", "memeContext", "imagePrompt"]
        }
      }
    });

    const data = JSON.parse(response.text);
    const imageUrl = await generateImageForMeme(data.imagePrompt);
    return { ...data, imageUrl, difficulty: data.difficulty as Difficulty };
  }

  let prompt = "";
  let responseSchema: any = {
    type: Type.OBJECT,
    properties: {
      polish: { type: Type.STRING },
      topic: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: Object.values(Difficulty) }
    },
    required: ["polish", "difficulty"]
  };

  if (mode === AppMode.CLOZE) {
    prompt = `Wygeneruj zdanie do uzupełnienia luki (odmiana czasownika) na poziomie ${difficulty}. Czas: ${selectedTense || 'dowolny'}.${exclusionContext}`;
    responseSchema.properties.clozeSentence = { type: Type.STRING };
    responseSchema.properties.correctAnswer = { type: Type.STRING };
    responseSchema.properties.tense = { type: Type.STRING, enum: Object.values(Tense) };
    responseSchema.required.push("clozeSentence", "correctAnswer", "tense");
  } else if (mode === AppMode.SPEECH) {
    prompt = `Wygeneruj ciekawe zdanie po niemiecku na poziomie ${difficulty}.${exclusionContext}`;
    responseSchema.properties.german = { type: Type.STRING };
    responseSchema.required.push("german");
  } else if (mode === AppMode.WORDS) {
    prompt = `Wygeneruj przydatne słowo po polsku na poziomie ${difficulty}.${exclusionContext}`;
  } else {
    prompt = `Wygeneruj praktyczne zdanie po polsku na poziomie ${difficulty}.${exclusionContext}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  });

  try {
    const data = JSON.parse(response.text);
    if (mode === AppMode.WORDS) {
      const imgResp = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Minimalist illustration of "${data.polish}" for language learning.` }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      for (const part of imgResp.candidates[0].content.parts) {
        if (part.inlineData) data.imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return { ...data, isWord: mode === AppMode.WORDS };
  } catch (e) {
    return { polish: "Samochód", difficulty: Difficulty.A1, topic: "Podstawy" };
  }
};

export const evaluateSpeech = async (germanText: string, audioBase64: string): Promise<Feedback> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    contents: [{
      parts: [
        { inlineData: { mimeType: 'audio/webm;codecs=opus', data: audioBase64 } },
        { text: `Oceń wymowę: "${germanText}".` }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          score: { type: Type.INTEGER },
          corrections: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
          correctVersion: { type: Type.STRING }
        },
        required: ["isCorrect", "score", "explanation", "correctVersion", "corrections"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const checkTranslation = async (challenge: Challenge, userTranslation: string, difficulty: Difficulty, mode: AppMode): Promise<Feedback> => {
  const prompt = mode === AppMode.CLOZE ? `Zdanie: "${challenge.clozeSentence}", Czas: ${challenge.tense}, Odpowiedź: "${userTranslation}".` : `Oryginał (PL): "${challenge.polish}", Tłumaczenie (DE): "${userTranslation}".`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          score: { type: Type.INTEGER },
          corrections: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
          correctVersion: { type: Type.STRING }
        },
        required: ["isCorrect", "score", "explanation", "correctVersion"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const speakText = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say in German: ${text}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const decode = (b64: string) => new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));
  const decodeAudio = async (data: Uint8Array) => {
    const int16 = new Int16Array(data.buffer);
    const buf = ctx.createBuffer(1, int16.length, 24000);
    buf.getChannelData(0).set(Array.from(int16).map(v => v / 32768.0));
    return buf;
  };
  const source = ctx.createBufferSource();
  source.buffer = await decodeAudio(decode(base64Audio));
  source.connect(ctx.destination);
  source.start();
};
