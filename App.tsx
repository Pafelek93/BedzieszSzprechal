
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, Challenge, Feedback, UserStats, AppMode, Tense, ContextSentence } from './types';
import { generateChallenge, checkTranslation, speakText, evaluateSpeech } from './services/geminiService';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Volume2, 
  Trophy, 
  ChevronRight, 
  BrainCircuit,
  Type as TypeIcon,
  MessageSquareQuote,
  GraduationCap,
  PencilLine,
  Mic,
  Square,
  Menu,
  X,
  Settings,
  Laugh,
  ExternalLink,
  Info,
  Wand2,
  Sparkles,
  Eye,
  EyeOff,
  Search
} from 'lucide-react';

const STORAGE_KEYS = {
  MASTERED_SENTENCES: 'deutschmaster_mastered_sentences',
  MASTERED_WORDS: 'deutschmaster_mastered_words',
  MASTERED_CLOZE: 'deutschmaster_mastered_cloze',
  MASTERED_SPEECH: 'deutschmaster_mastered_speech',
  MASTERED_MEMES: 'deutschmaster_mastered_memes',
  MASTERED_CONTEXT: 'deutschmaster_mastered_context',
  STATS: 'deutschmaster_user_stats'
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SENTENCES);
  const [selectedTense, setSelectedTense] = useState<Tense>(Tense.PRESENT);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [userTranslation, setUserTranslation] = useState('');
  const [customWordInput, setCustomWordInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMemeInfo, setShowMemeInfo] = useState(false);
  const [visibleTranslations, setVisibleTranslations] = useState<Record<number, boolean>>({});
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS);
    return saved ? JSON.parse(saved) : { points: 0, sentencesCompleted: 0, streak: 0, level: Difficulty.A1 };
  });

  const [masteredSentences] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_SENTENCES) || '[]'));
  const [masteredWords] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_WORDS) || '[]'));
  const [masteredCloze] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_CLOZE) || '[]'));
  const [masteredSpeech] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_SPEECH) || '[]'));
  const [masteredMemes] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_MEMES) || '[]'));
  const [masteredContext] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MASTERED_CONTEXT) || '[]'));

  const fetchNextChallenge = useCallback(async (difficulty?: Difficulty, targetMode?: AppMode, tense?: Tense, word?: string) => {
    setLoading(true);
    setFeedback(null);
    setUserTranslation('');
    setShowMemeInfo(false);
    setVisibleTranslations({});
    try {
      const activeDifficulty = difficulty || stats.level;
      const activeMode = targetMode || mode;
      const activeTense = tense || selectedTense;
      
      let exclusionList = masteredSentences;
      if (activeMode === AppMode.WORDS) exclusionList = masteredWords;
      if (activeMode === AppMode.CLOZE) exclusionList = masteredCloze;
      if (activeMode === AppMode.SPEECH) exclusionList = masteredSpeech;
      if (activeMode === AppMode.MEMES) exclusionList = masteredMemes;
      if (activeMode === AppMode.CONTEXT) exclusionList = masteredContext;

      const challenge = await generateChallenge(activeDifficulty, activeMode, exclusionList, activeTense, word);
      setCurrentChallenge(challenge);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [mode, stats.level, masteredSentences, masteredWords, masteredCloze, masteredSpeech, masteredMemes, masteredContext, selectedTense]);

  useEffect(() => {
    fetchNextChallenge();
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setIsMenuOpen(false);
    if (newMode !== AppMode.CONTEXT) {
      fetchNextChallenge(stats.level, newMode);
    } else {
      setCurrentChallenge(null);
      setFeedback(null);
    }
  };

  const handleDifficultyChange = (newLevel: Difficulty) => {
    setStats(s => ({ ...s, level: newLevel }));
    
    // Jeśli jesteśmy w trybie kontekstownika i mamy już wybrane słowo
    if (mode === AppMode.CONTEXT && currentChallenge?.targetWord) {
      fetchNextChallenge(newLevel, mode, selectedTense, currentChallenge.targetWord);
    } else if (mode !== AppMode.CONTEXT) {
      // Dla innych trybów generuj nowe zadanie na nowym poziomie
      fetchNextChallenge(newLevel);
    }
  };

  const getModeLabel = (m: AppMode) => {
    switch(m) {
      case AppMode.SENTENCES: return "Zdania";
      case AppMode.WORDS: return "Słówka";
      case AppMode.CLOZE: return "Gramatyka";
      case AppMode.SPEECH: return "Wymowa";
      case AppMode.MEMES: return "Memy DE";
      case AppMode.CONTEXT: return "Kontekstownik";
    }
  };

  const getModeIcon = (m: AppMode) => {
    switch(m) {
      case AppMode.SENTENCES: return <MessageSquareQuote className="w-5 h-5" />;
      case AppMode.WORDS: return <TypeIcon className="w-5 h-5" />;
      case AppMode.CLOZE: return <PencilLine className="w-5 h-5" />;
      case AppMode.SPEECH: return <Mic className="w-5 h-5" />;
      case AppMode.MEMES: return <Laugh className="w-5 h-5" />;
      case AppMode.CONTEXT: return <Search className="w-5 h-5" />;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setChecking(true);
          try {
            const result = await evaluateSpeech(currentChallenge!.german!, base64Audio);
            setFeedback(result);
            processFeedback(result);
          } finally { setChecking(false); }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err) { alert("Mikrofon niedostępny."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const processFeedback = (result: Feedback) => {
    if (result.isCorrect || result.score >= 80) {
      setStats(prev => {
        const newStats = { ...prev, points: prev.points + 5, streak: prev.streak + 1, sentencesCompleted: prev.sentencesCompleted + 1 };
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(newStats));
        return newStats;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChallenge || !userTranslation.trim() || checking) return;
    setChecking(true);
    try {
      const result = await checkTranslation(currentChallenge, userTranslation, stats.level, mode);
      setFeedback(result);
      processFeedback(result);
    } finally { setChecking(false); }
  };

  const generateWithCustomWord = () => {
    if (!customWordInput.trim()) return;
    fetchNextChallenge(stats.level, AppMode.CONTEXT, selectedTense, customWordInput);
  };

  const toggleTranslation = (idx: number) => {
    setVisibleTranslations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 p-1.5 rounded-lg shrink-0">
              <BrainCircuit className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 hidden xs:block">DeutschMaster</h1>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex bg-slate-100 p-1 rounded-xl mr-1">
              {Object.values(Difficulty).map(level => (
                <button 
                  key={level} 
                  onClick={() => handleDifficultyChange(level)}
                  className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${stats.level === level ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  {level}
                </button>
              ))}
            </div>
            
            <div className="bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
              <Trophy className="w-3 h-3 text-yellow-600" /> {stats.points}
            </div>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-xl transition-all flex items-center gap-1 border-2 ${isMenuOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-100'}`}>
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200 z-50">
                  <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase border-b border-slate-50 mb-1">Nauka</p>
                  {Object.values(AppMode).map((m) => (
                    <button key={m} onClick={() => handleModeChange(m)} className={`w-full px-4 py-3 flex items-center gap-3 text-sm font-bold transition-colors ${mode === m ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                      {getModeIcon(m)} {getModeLabel(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {mode === AppMode.CONTEXT && !currentChallenge && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200 mb-4">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Kontekstownik</h2>
              <p className="text-sm text-slate-500 font-medium">Poznaj 20 przykładów użycia niemieckiego słowa</p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Słowo (tylko DE):</label>
                <input 
                  type="text" 
                  value={customWordInput}
                  onChange={(e) => setCustomWordInput(e.target.value)}
                  placeholder="np. Zeit, laufen, wunderschön..."
                  className="w-full p-5 border-2 border-slate-100 rounded-2xl text-lg font-bold outline-none focus:border-blue-500 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && generateWithCustomWord()}
                />
              </div>
              <button 
                onClick={generateWithCustomWord}
                disabled={!customWordInput.trim()}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest shadow-xl shadow-blue-100 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Sparkles className="w-5 h-5" /> Wygeneruj 20 przykładów
              </button>
            </div>
          </div>
        )}

        {(currentChallenge || loading) && (
          <>
            {mode === AppMode.CONTEXT && currentChallenge?.contextSentences ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Search className="w-6 h-6 text-blue-600" />
                    <div>
                       <h2 className="text-xl font-black text-slate-800 uppercase leading-none">Kontekstownik</h2>
                       <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Słowo: <span className="text-blue-600">{currentChallenge.targetWord}</span></p>
                    </div>
                  </div>
                  <button onClick={() => {setCurrentChallenge(null); setCustomWordInput('');}} className="p-2 bg-slate-100 text-slate-600 rounded-xl"><RefreshCw className="w-4 h-4" /></button>
                </div>

                <div className="space-y-3">
                  {currentChallenge.contextSentences.map((sentence, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="text-[9px] font-black text-slate-300 uppercase mb-1 block">Przykład {idx + 1}</span>
                          <p className="text-lg font-bold text-slate-800 leading-snug">
                            {sentence.german.split(new RegExp(`(${currentChallenge.targetWord})`, 'gi')).map((part, i) => 
                              part.toLowerCase() === (currentChallenge.targetWord || "").toLowerCase() 
                                ? <span key={i} className="text-blue-600 underline decoration-2 underline-offset-4">{part}</span> 
                                : part
                            )}
                          </p>
                          
                          {visibleTranslations[idx] && (
                            <p className="mt-2 text-sm text-slate-500 font-medium border-l-2 border-slate-100 pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              {sentence.polish}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                           <button onClick={() => speakText(sentence.german)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors">
                             <Volume2 className="w-5 h-5" />
                           </button>
                           <button onClick={() => toggleTranslation(idx)} className={`p-3 rounded-2xl transition-colors ${visibleTranslations[idx] ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                             {visibleTranslations[idx] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                           </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => {setCurrentChallenge(null); setCustomWordInput('');}}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2"
                >
                  Wpisz nowe słowo <Search className="w-4 h-4" />
                </button>
              </div>
            ) : mode === AppMode.MEMES ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laugh className="w-5 h-5 text-purple-600" />
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Niemieckie Memy</h2>
                  </div>
                  <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-3 py-1 rounded-full uppercase">Kultura i Humor</span>
                </div>

                {loading ? (
                  <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 shadow-sm border border-slate-200">
                    <RefreshCw className="w-10 h-10 text-purple-600 animate-spin" />
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Szukam śmiesznych rzeczy...</p>
                  </div>
                ) : currentChallenge && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                      <div className="relative">
                        {currentChallenge.imageUrl ? (
                          <img src={currentChallenge.imageUrl} className="w-full aspect-square object-cover" alt="Meme" />
                        ) : (
                          <div className="w-full aspect-square bg-slate-100 flex items-center justify-center">
                            <Laugh className="w-20 h-20 text-slate-200" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                          <h3 className="text-white font-black text-2xl uppercase tracking-tight drop-shadow-lg text-center leading-tight">
                            {currentChallenge.memeGermanText}
                          </h3>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="bg-white p-2 rounded-xl shadow-sm"><Info className="w-5 h-5 text-blue-600" /></div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Co to znaczy?</p>
                            <p className="text-sm font-bold text-slate-700 italic">"{currentChallenge.polish}"</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <button 
                              onClick={() => setShowMemeInfo(!showMemeInfo)}
                              className="w-full flex items-center justify-between p-4 bg-purple-50 text-purple-700 rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm active:scale-[0.98] transition-all"
                            >
                              {showMemeInfo ? 'Ukryj wyjaśnienie' : 'Dlaczego to jest śmieszne?'}
                              {showMemeInfo ? <X className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>

                          {showMemeInfo && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                              <div className="bg-white p-5 rounded-2xl border-2 border-purple-100">
                                <h4 className="font-black text-slate-800 uppercase text-[10px] mb-2 text-purple-600">Wyjaśnienie żartu:</h4>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">{currentChallenge.memeExplanation}</p>
                              </div>
                              <div className="bg-purple-600 p-5 rounded-2xl text-white shadow-lg">
                                <h4 className="font-black uppercase text-[10px] mb-2 opacity-80">Kontekst kulturowy:</h4>
                                <p className="text-sm leading-relaxed font-bold">{currentChallenge.memeContext}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <button onClick={() => speakText(currentChallenge.memeGermanText || '')} className="flex-1 bg-white border-2 border-slate-100 text-slate-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors">
                            <Volume2 className="w-4 h-4" /> Posłuchaj
                          </button>
                          <button onClick={() => fetchNextChallenge()} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
                            Następny Mem <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tryb:</span>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 uppercase">
                      {getModeLabel(mode)}
                    </span>
                  </div>
                </div>

                {mode === AppMode.CLOZE && (
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pb-4 mb-2">
                    {Object.values(Tense).map(t => (
                      <button key={t} onClick={() => { setSelectedTense(t); fetchNextChallenge(stats.level, mode, t); }}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTense === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-6">
                  <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${mode === AppMode.SPEECH ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {mode === AppMode.SPEECH ? 'Powiedz na głos' : mode === AppMode.CLOZE ? `Gramatyka` : 'Tłumaczenie'}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">{currentChallenge?.topic || 'Ogólne'}</span>
                      </div>
                    </div>
                    
                    {loading ? (
                      <div className="animate-pulse space-y-4"><div className="h-10 bg-slate-200 rounded w-full"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></div>
                    ) : (
                      <div className="text-center sm:text-left space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Po polsku:</p>
                          <h2 className="text-xl font-medium text-slate-600 italic leading-relaxed">
                            {currentChallenge?.polish}
                          </h2>
                        </div>
                        {mode === AppMode.SPEECH && (
                          <div className="bg-white p-6 rounded-2xl border-2 border-red-50 shadow-sm relative">
                            <p className="text-[10px] font-black text-red-400 uppercase mb-2">Przeczytaj:</p>
                            <h2 className="text-2xl font-black text-slate-900 leading-snug">{currentChallenge?.german}</h2>
                            <button onClick={() => speakText(currentChallenge?.german || '')} className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-full"><Volume2 className="w-6 h-6" /></button>
                          </div>
                        )}
                        {mode === AppMode.CLOZE && (
                          <p className="text-xl font-bold text-blue-900 tracking-wide">{currentChallenge?.clozeSentence}</p>
                        )}
                        {mode === AppMode.WORDS && currentChallenge?.imageUrl && (
                          <img src={currentChallenge.imageUrl} className="w-32 h-32 rounded-2xl mx-auto sm:mx-0 object-cover border-4 border-white shadow-md" alt="Visual" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    {mode === AppMode.SPEECH ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-6">
                         {isRecording && <div className="flex items-center gap-2 animate-pulse text-red-600 font-black text-sm uppercase">Nagrywanie... {recordTime}s</div>}
                         <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} disabled={checking || !!feedback} className={`w-28 h-28 rounded-full shadow-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 text-white scale-110' : 'bg-slate-100 text-red-600 hover:bg-red-50'}`}>
                           {isRecording ? <Square className="w-10 h-10 fill-current" /> : <Mic className="w-12 h-12" />}
                         </button>
                         <p className="text-xs font-black text-slate-400 uppercase text-center">{isRecording ? "Puść, aby zakończyć" : "Przytrzymaj mikrofon i przeczytaj"}</p>
                         {checking && <div className="flex items-center gap-2 text-blue-600 font-bold"><RefreshCw className="w-4 h-4 animate-spin" /> Analizuję...</div>}
                         {feedback && <button onClick={() => fetchNextChallenge()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg">Następne wyzwanie</button>}
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <textarea 
                          value={userTranslation} 
                          onChange={(e) => setUserTranslation(e.target.value)} 
                          disabled={loading || checking || !!feedback} 
                          className="w-full p-5 border-2 border-slate-100 rounded-2xl text-lg font-medium outline-none focus:border-blue-500" 
                          placeholder="Twoja odpowiedź..." 
                          rows={1} 
                        />
                        <div className="flex gap-3">
                          <button type="submit" disabled={loading || checking || !userTranslation.trim() || !!feedback} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl">
                            {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Sprawdź'}
                          </button>
                          {feedback && (
                            <button 
                              type="button" 
                              onClick={() => fetchNextChallenge()} 
                              className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl"
                            >
                              Dalej
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>

                  {feedback && (
                    <div className={`p-6 border-t ${feedback.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-xl ${feedback.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {feedback.isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        </div>
                        <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest">{feedback.isCorrect ? 'Brawo!' : 'Prawie...'}</h3>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-black text-slate-900 leading-relaxed"><span className="text-[10px] uppercase text-slate-400 block mb-1">Poprawnie:</span> {feedback.correctVersion}</p>
                        <p className="text-sm text-slate-700 italic border-l-4 border-slate-200 pl-4 py-1">{feedback.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          <Stat icon={<Trophy className="w-4 h-4" />} label="Poziom" value={stats.level} color="text-yellow-600" />
          <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Sesje" value={stats.sentencesCompleted} color="text-green-600" />
          <Stat icon={<BrainCircuit className="w-4 h-4" />} label="Punkty" value={stats.points} color="text-blue-600" />
          <Stat icon={<GraduationCap className="w-4 h-4" />} label="Famy" value={stats.sentencesCompleted + stats.points} color="text-purple-600" />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t text-center text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] z-10">
        Będziesz Szprechał • Powered by Gemini AI
      </footer>
    </div>
  );
};

const Stat: React.FC<{ icon: any, label: string, value: any, color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
    <div className={`p-2 bg-slate-50 rounded-xl ${color}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[9px] font-black text-slate-400 uppercase truncate">{label}</p>
      <p className="text-sm font-black text-slate-800 truncate">{value}</p>
    </div>
  </div>
);

export default App;
