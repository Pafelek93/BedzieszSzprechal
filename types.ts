
export enum Difficulty {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1'
}

export enum AppMode {
  SENTENCES = 'SENTENCES',
  WORDS = 'WORDS',
  CLOZE = 'CLOZE',
  SPEECH = 'SPEECH',
  MEMES = 'MEMES' // Nowy dział: Memy
}

export enum Tense {
  PRESENT = 'Präsens',
  PERFECT = 'Perfekt',
  PAST = 'Präteritum',
  FUTURE = 'Futur I'
}

export interface Challenge {
  polish: string;
  german?: string;
  difficulty: Difficulty;
  topic?: string;
  isWord?: boolean;
  imageUrl?: string;
  clozeSentence?: string;
  correctAnswer?: string;
  tense?: Tense;
  // Pola dla memów
  memeGermanText?: string;
  memeExplanation?: string;
  memeContext?: string;
  memeTitle?: string;
}

export interface Feedback {
  isCorrect: boolean;
  score: number;
  corrections: string[];
  explanation: string;
  correctVersion: string;
  alternativeVersions?: string[];
}

export interface UserStats {
  points: number;
  sentencesCompleted: number;
  streak: number;
  level: Difficulty;
}
