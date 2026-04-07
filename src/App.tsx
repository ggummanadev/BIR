/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  BookOpen, 
  LogOut, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Send, 
  History,
  Sparkles,
  Download,
  Library as LibraryIcon,
  Dices,
  Edit2,
  Image as ImageIcon,
  Minus,
  PlusCircle,
  Save,
  Trash2,
  Settings
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { cn } from './lib/utils';
import { CATEGORIES, STYLES, VIBES } from './constants';
import { SelectionStep, SelectionState, Story, Page } from './types';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const getAI = () => {
  const customKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey: customKey || process.env.GEMINI_API_KEY || '' });
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const DICT = {
  ko: {
    library: "나의 서재",
    newStory: "새 책 만들기",
    noStories: "아직 생성된 책이 없습니다.",
    completed: "완성됨",
    inProgress: "작성중",
    categoryQ: "어떤 종류의 글을 읽고 싶나요?",
    subCategoryQ: "의 어떤 분야인가요?",
    styleQ: "어떤 스타일로 쓰여지길 원하시나요?",
    vibeQ: "어떤 느낌의 글인가요?",
    keywordsQ: "추가하고 싶은 키워드나 내용이 있나요?",
    keywordsPlaceholder: "예: 주인공이 고양이, 반전 결말...",
    next: "다음",
    pagesQ: "몇 페이지 분량으로 만들까요?",
    pagesHint: "페이지수를 정한 후 이곳을 터치하세요",
    createStory: "이야기 만들기",
    nextVibeQ: "다음 10페이지는 어떤 느낌으로 쓸까요?",
    generating: "이야기를 짓는 중입니다...",
    generatingDesc: "비눗방울 속에 문장들이 채워지고 있어요.",
    next10Pages: "다음 10페이지 생성하기",
    random: "랜덤",
    typeBHint: "또는 참고하고 싶은 도서명/URL을 입력하세요",
    recent: "최근 읽은 목록",
    appTitle: "Bubble Inspiration",
    appDesc: "비눗방울을 터뜨리며 당신만의 이야기를 만들어보세요.",
    login: "Google로 시작하기",
    logout: "로그아웃",
    editTitle: "제목 수정",
    generateCover: "커버 생성",
    continueStory: "다음 페이지 작성",
    translating: "번역 중...",
    save: "저장",
    cancel: "취소",
    delete: "삭제",
    settings: "설정"
  },
  en: {
    library: "My Library",
    newStory: "New Story",
    noStories: "No stories generated yet.",
    completed: "Completed",
    inProgress: "In Progress",
    categoryQ: "What kind of story do you want to read?",
    subCategoryQ: "Which sub-genre?",
    styleQ: "What style should it be written in?",
    vibeQ: "What is the vibe of the story?",
    keywordsQ: "Any specific keywords or details to add?",
    keywordsPlaceholder: "e.g., The main character is a cat, plot twist...",
    next: "Next",
    pagesQ: "How many pages should we make?",
    pagesHint: "Set the pages and touch here",
    createStory: "Create Story",
    nextVibeQ: "What vibe for the next 10 pages?",
    generating: "Crafting your story...",
    generatingDesc: "Filling the bubbles with sentences.",
    next10Pages: "Generate next 10 pages",
    random: "Random",
    typeBHint: "Or enter a book title/URL to reference",
    recent: "Recently Read",
    appTitle: "Bubble Inspiration",
    appDesc: "Pop the bubbles to create your own story.",
    login: "Continue with Google",
    logout: "Logout",
    editTitle: "Edit Title",
    generateCover: "Generate Cover",
    continueStory: "Write Next Pages",
    translating: "Translating...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    settings: "Settings"
  }
};

// --- Components ---

const Bubble = ({ 
  label, 
  onClick, 
  onEdit,
  color = "bg-blue-400", 
  size = "w-32 h-32" 
}: { 
  label: string; 
  onClick: (label: string) => void; 
  onEdit?: (newLabel: string) => void;
  color?: string; 
  size?: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => { setEditValue(label); }, [label]);

  const handleStart = () => {
    timerRef.current = setTimeout(() => setIsEditing(true), 600);
  };
  const handleEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleSave = () => {
    setIsEditing(false);
    if (editValue.trim() !== '' && editValue.trim() !== label && onEdit) {
      onEdit(editValue.trim());
    } else {
      setEditValue(label);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: isEditing ? 1 : 1.1 }}
      whileTap={{ scale: isEditing ? 1 : 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.3 } }}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onDoubleClick={() => setIsEditing(true)}
      onClick={(e) => {
        if (!isEditing) onClick(label);
      }}
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer transition-colors border-4 border-white/30 backdrop-blur-sm",
        color,
        size
      )}
    >
      {isEditing ? (
        <input 
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            e.stopPropagation();
          }}
          onClick={e => e.stopPropagation()}
          className="w-3/4 bg-black/20 text-center text-white placeholder-white/50 outline-none rounded px-1"
        />
      ) : (
        <span className="text-center px-2 pointer-events-none select-none">{label}</span>
      )}
    </motion.button>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const t = (key: keyof typeof DICT.ko) => DICT[lang][key];

  const [customCategories, setCustomCategories] = useState(CATEGORIES);
  const [customStyles, setCustomStyles] = useState(STYLES);
  const [customVibes, setCustomVibes] = useState(VIBES);

  const [step, setStep] = useState<SelectionStep>('category');

  const [selection, setSelection] = useState<SelectionState>({});
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [referenceInput, setReferenceInput] = useState('');
  const [nextVibe, setNextVibe] = useState<string>('랜덤');
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Auth listener
  useEffect(() => {
    if (!process.env.GEMINI_API_KEY && !localStorage.getItem('CUSTOM_GEMINI_API_KEY')) {
      console.warn("GEMINI_API_KEY is missing. Content generation will not work until you add it to your environment variables or settings.");
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Translation effect
  useEffect(() => {
    if (!currentStory || pages.length === 0 || isTranslating) return;

    const translateIfNeeded = async () => {
      // Check if we need translation: if lang is different from story language
      // or if we just want to ensure translatedContent exists for the other language.
      const needsTranslation = pages.some(p => !p.translatedContent);
      if (!needsTranslation) return;

      setIsTranslating(true);
      try {
        for (const page of pages) {
          if (page.translatedContent) continue;

          const prompt = `Translate the following story content.
          From: ${lang === 'ko' ? 'English' : 'Korean'}
          To: ${lang === 'ko' ? 'Korean' : 'English'}
          Content: ${page.content}
          Return ONLY the translated text.`;

          const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
          });

          await updateDoc(doc(db, `stories/${currentStory.id}/pages`, page.id), {
            translatedContent: response.text
          });
        }
      } catch (error) {
        console.error("Translation failed", error);
      } finally {
        setIsTranslating(false);
      }
    };

    // We only trigger this if the user is in the "other" language
    // For simplicity, let's say original is always what it was generated in.
    // If currentStory.language !== lang, we might need translation.
    if (currentStory.language !== lang) {
      translateIfNeeded();
    }
  }, [lang, currentStory, pages, isTranslating]);

  // Stories listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(storyData);
    });
    return () => unsubscribe();
  }, [user]);

  // Pages listener
  useEffect(() => {
    if (!currentStory) return;
    const q = query(
      collection(db, `stories/${currentStory.id}/pages`),
      orderBy('pageNumber', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pageData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Page));
      setPages(pageData);
    });
    return () => unsubscribe();
  }, [currentStory]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm(lang === 'ko' ? '정말 이 책을 삭제하시겠습니까?' : 'Are you sure you want to delete this story?')) return;
    try {
      // Delete pages subcollection first
      const pagesRef = collection(db, `stories/${storyId}/pages`);
      const pagesSnap = await getDocs(pagesRef);
      for (const p of pagesSnap.docs) {
        await deleteDoc(doc(db, `stories/${storyId}/pages`, p.id));
      }
      // Delete story document
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}`);
    }
  };

  const handleEditTitle = async (story: Story) => {
    const newTitle = window.prompt(t('editTitle'), story.title);
    if (newTitle && newTitle !== story.title) {
      try {
        await updateDoc(doc(db, 'stories', story.id), { title: newTitle });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `stories/${story.id}`);
      }
    }
  };

  const handleGenerateCover = async (story: Story) => {
    setIsGenerating(true);
    try {
      const prompt = `A book cover illustration for a story titled "${story.title}". 
      Category: ${story.category}, Subcategory: ${story.subCategory}, Style: ${story.style}.
      The mood should be ${story.vibe}.
      Art style: ${story.style}.
      No text on the image. High quality, vibrant colors, artistic.`;
      
      const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: "3:4"
          }
        }
      });
      
      const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        try {
          await updateDoc(doc(db, 'stories', story.id), { coverUrl: imageUrl });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `stories/${story.id}`);
        }
      }
    } catch (error) {
      console.error("Cover generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSelection = () => {
    setStep('category');
    setSelection({});
    setCurrentStory(null);
    setReferenceInput('');
  };


  const startGeneration = async () => {
    if (!user) return;
    const hasApiKey = process.env.GEMINI_API_KEY || localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (!hasApiKey) {
      console.error("GEMINI_API_KEY is missing. Please set it in your environment variables or settings.");
      alert("API Key is missing. Please check your environment configuration or enter it in Settings.");
      return;
    }
    setIsGenerating(true);
    setStep('generating');

    try {
      if (currentStory) {
        // Continuing an existing story
        try {
          await updateDoc(doc(db, 'stories', currentStory.id), {
            totalPages: selection.totalPages || currentStory.totalPages + 10,
            isCompleted: false
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `stories/${currentStory.id}`);
        }
        
        const updatedStory = {
          ...currentStory,
          totalPages: selection.totalPages || currentStory.totalPages + 10,
          isCompleted: false
        };
        
        setCurrentStory(updatedStory);
        generateNextPages(updatedStory, selection, currentStory.currentPage, currentStory.vibe || '랜덤');
        return;
      }

      let finalSelection = { ...selection };

      // If Type B (Reference Input)
      if (referenceInput) {
        const analysisResponse = await getAI().models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Analyze the following book title or URL and provide a detailed summary and the best category, subcategory, style, and vibe for a similar story.
          Input: ${referenceInput}
          Return JSON format: { "category": "...", "subCategory": "...", "style": "...", "vibe": "...", "title": "...", "summary": "..." }`,
          config: { responseMimeType: "application/json" }
        });
        
        const analysis = JSON.parse(analysisResponse.text || '{}');
        finalSelection = {
          ...finalSelection,
          ...analysis,
          keywords: '', // Clear keywords when using reference
          referenceInput
        };
      }

      const storyTitle = finalSelection.title || `${finalSelection.subCategory || '이야기'} - ${new Date().toLocaleDateString()}`;

      let storyDoc;
      try {
        storyDoc = await addDoc(collection(db, 'stories'), {
          userId: user.uid,
          title: storyTitle,
          category: finalSelection.category || '기타',
          subCategory: finalSelection.subCategory || '기타',
          style: finalSelection.style || '기타',
          vibe: finalSelection.vibe || '기타',
          keywords: finalSelection.keywords || '',
          language: lang,
          totalPages: selection.totalPages || 10,
          currentPage: 0,
          createdAt: serverTimestamp(),
          isCompleted: false,
          referenceBooks: referenceInput ? [referenceInput] : [],
          summary: finalSelection.summary || ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'stories');
      }

      const newStory = {
        id: storyDoc.id,
        userId: user.uid,
        title: storyTitle,
        category: finalSelection.category,
        subCategory: finalSelection.subCategory,
        style: finalSelection.style,
        vibe: finalSelection.vibe,
        keywords: finalSelection.keywords,
        language: lang,
        totalPages: selection.totalPages || 10,
        currentPage: 0,
        createdAt: new Date(),
        isCompleted: false,
        summary: finalSelection.summary || ''
      } as Story;

      setCurrentStory(newStory);
      generateNextPages(newStory, finalSelection, 0, finalSelection.vibe || '랜덤');

    } catch (error) {
      console.error("Generation failed", error);
      setIsGenerating(false);
    }
  };

  const generateNextPages = async (story: Story, config: any, startPage: number, currentVibe: string) => {
    const hasApiKey = process.env.GEMINI_API_KEY || localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (!hasApiKey) {
      console.error("GEMINI_API_KEY is missing. Please set it in your environment variables or settings.");
      alert("API Key is missing. Please check your environment configuration or enter it in Settings.");
      return;
    }
    const batchSize = 10;
    const endPage = Math.min(startPage + batchSize, story.totalPages);
    
    setIsGenerating(true);
    setStep('generating');

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        const previousPagesSummary = pages.length > 0 
          ? `Summary of previous content: ${pages.map(p => p.content).join(' ').substring(0, 1500)}...`
          : '';

        const referenceContext = story.summary ? `Reference Material Summary: ${story.summary}` : '';

        const prompt = `You are a creative writer. Write a story based on the following details.
        
        Story Details:
        - Title: ${story.title}
        - Category: ${story.category} / ${story.subCategory}
        - Style: ${story.style}
        - Keywords: ${story.keywords || 'None'}
        - Vibe: ${currentVibe === '랜덤' ? 'Surprising and dynamic' : currentVibe}
        - Language: ${story.language === 'ko' ? 'Korean' : 'English'}
        ${referenceContext}
        
        Task:
        Write pages ${startPage + 1} to ${endPage} (Total pages in story: ${story.totalPages}).
        ${previousPagesSummary}
        
        Constraints:
        - If the genre is poetry, use appropriate poetic forms.
        - Maintain consistency with previous pages.
        - Use clear paragraph breaks (double newlines) between different sections or thoughts.
        - Ensure the text is clean, without repetitive symbols or unnecessary line breaks.
        - Return the result strictly as a JSON array of objects.
        
        JSON Format:
        [
          {
            "pageNumber": ${startPage + 1},
            "content": "Content for page ${startPage + 1} in Markdown format"
          }
        ]`;

        const response = await getAI().models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.NUMBER },
                  content: { type: Type.STRING }
                },
                required: ["pageNumber", "content"]
              }
            }
          }
        });

        const cleanContent = (text: string) => {
          return text
            .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
            .replace(/\\n/g, '\n') // Fix escaped newlines if any
            .trim();
        };

        const newPages = JSON.parse(response.text || '[]').map((p: any) => ({
          ...p,
          content: cleanContent(p.content)
        }));
        
        for (const page of newPages) {
          try {
            await addDoc(collection(db, `stories/${story.id}/pages`), {
              storyId: story.id,
              pageNumber: page.pageNumber,
              content: page.content,
              createdAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `stories/${story.id}/pages`);
          }
        }

        try {
          await updateDoc(doc(db, 'stories', story.id), {
            currentPage: endPage,
            isCompleted: endPage >= story.totalPages
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `stories/${story.id}`);
        }

        success = true;
        setIsGenerating(false);
        setStep('reading');
      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          console.error("Page generation failed after retries", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert(`Page generation failed: ${errorMessage}\n\nPlease check your Gemini API key and quota. If you are using a free key, ensure you haven't exceeded the rate limit.`);
          setIsGenerating(false);
          setStep('reading');
        } else {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  };

  const downloadPDF = async () => {
    if (!currentStory || pages.length === 0) return;
    
    const printDiv = document.createElement('div');
    printDiv.style.padding = '20px';
    printDiv.style.fontFamily = 'sans-serif';
    
    let html = `
      <h1 style="font-size: 24px; margin-bottom: 10px;">${currentStory.title}</h1>
      <p style="font-size: 12px; color: #666; margin-bottom: 5px;">${currentStory.category} / ${currentStory.subCategory}</p>
      <p style="font-size: 12px; color: #666; margin-bottom: 20px;">Style: ${currentStory.style}</p>
    `;
    
    pages.forEach((page, index) => {
      html += `
        <div style="${index > 0 ? 'page-break-before: always; ' : ''}margin-top: 20px;">
          <h3 style="font-size: 14px; margin-bottom: 10px;">Page ${page.pageNumber}</h3>
          <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${page.content.replace(/[#*`]/g, '')}</div>
        </div>
      `;
    });
    
    printDiv.innerHTML = html;
    
    const opt = {
      margin:       10,
      filename:     `${currentStory.title}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(printDiv).save();
  };

  const handleBack = () => {
    if (step === 'subCategory') setStep('category');
    else if (step === 'style') setStep('subCategory');
    else if (step === 'vibe') setStep('style');
    else if (step === 'keywords') setStep('vibe');
    else if (step === 'pages') setStep('keywords');
    else if (step === 'library') setStep('category');
    else if (step === 'reading') setStep('library');
    else if (step === 'nextVibe') setStep('reading');
  };

  const handleRandom = () => {
    if (step === 'category') {
      const randomCat = customCategories[Math.floor(Math.random() * customCategories.length)];
      setSelection({ ...selection, category: randomCat.label });
      setStep('subCategory');
    } else if (step === 'subCategory') {
      const cat = customCategories.find(c => c.label === selection.category);
      if (cat && cat.subCategories.length > 0) {
        const randomSub = cat.subCategories[Math.floor(Math.random() * cat.subCategories.length)];
        setSelection({ ...selection, subCategory: randomSub });
        setStep('style');
      }
    } else if (step === 'style') {
      const randomStyle = customStyles[Math.floor(Math.random() * customStyles.length)];
      setSelection({ ...selection, style: randomStyle.label });
      setStep('vibe');
    } else if (step === 'vibe') {
      const randomVibe = customVibes[Math.floor(Math.random() * customVibes.length)];
      setSelection({ ...selection, vibe: randomVibe.label });
      setStep('keywords');
    } else if (step === 'keywords') {
      setSelection({ ...selection, keywords: "Surprise me!" });
      setStep('pages');
    } else if (step === 'pages') {
      setSelection({ ...selection, totalPages: Math.floor(Math.random() * 10 + 1) * 10 });
      startGeneration();
    } else if (step === 'nextVibe') {
      const randomVibe = customVibes[Math.floor(Math.random() * customVibes.length)];
      generateNextPages(currentStory!, selection, currentStory!.currentPage, randomVibe.label);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl border-4 border-blue-200">
            <Sparkles className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800">{t('appTitle')}</h1>
          <p className="text-slate-600">{t('appDesc')}</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {t('login')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={resetSelection}>
          <Sparkles className="w-6 h-6 text-blue-500" />
          <h1 className="font-bold text-xl tracking-tight hidden sm:block">{t('appTitle')}</h1>
        </div>
        
        <div className="flex-1 flex justify-center">
          {['category', 'subCategory', 'style', 'vibe', 'keywords', 'pages', 'nextVibe'].includes(step) && (
            <button 
              onClick={handleRandom}
              className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200 rounded-full transition-all shadow-sm flex items-center gap-1 text-indigo-600 font-bold"
              title="Random Choice"
            >
              <Dices className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 justify-end">
          <button 
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600"
          >
            {lang === 'ko' ? 'EN' : 'KO'}
          </button>
          <button 
            onClick={() => setStep('library')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title={t('library')}
          >
            <LibraryIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button 
            onClick={() => setStep('category')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title={t('newStory')}
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button 
            onClick={() => setStep('settings')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title={t('settings')}
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            title={t('logout')}
          >
            <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {/* Step: Library */}
          {step === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-8 max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-slate-800">{t('library')}</h2>
                <button onClick={() => setStep('category')} className="text-blue-500 font-bold flex items-center gap-1">
                  <Plus className="w-4 h-4" /> {t('newStory')}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stories.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-slate-400">
                    {t('noStories')}
                  </div>
                ) : (
                  stories.map(s => (
                    <motion.div 
                      key={s.id}
                      whileHover={{ y: -5 }}
                      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all relative group"
                    >
                      <div className="flex justify-between items-start mb-4" onClick={() => { setCurrentStory(s); setStep('reading'); }}>
                        <div className="w-12 h-16 bg-blue-100 rounded-md flex items-center justify-center overflow-hidden">
                          {s.coverUrl ? (
                            <img src={s.coverUrl} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <BookOpen className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          s.isCompleted ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {s.isCompleted ? t('completed') : t('inProgress')}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg truncate flex-1" onClick={() => { setCurrentStory(s); setStep('reading'); }}>{s.title}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditTitle(s); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500"
                            title={t('editTitle')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleGenerateCover(s); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-purple-500"
                            title={t('generateCover')}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteStory(s.id); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-500 mb-4" onClick={() => { setCurrentStory(s); setStep('reading'); }}>{s.category} / {s.subCategory}</p>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden" onClick={() => { setCurrentStory(s); setStep('reading'); }}>
                        <div 
                          className="bg-blue-500 h-full transition-all duration-500" 
                          style={{ width: `${(s.currentPage / s.totalPages) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-slate-400 text-right">
                        {s.currentPage} / {s.totalPages} PAGES
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Step: Settings */}
          {step === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-8 max-w-2xl mx-auto w-full"
            >
              <h2 className="text-3xl font-black text-slate-800 mb-8">{t('settings')}</h2>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API Key</label>
                  <p className="text-xs text-slate-500 mb-2">
                    Enter your Gemini API key to use your own quota. This will be saved locally in your browser.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="password"
                      value={customApiKey}
                      onChange={(e) => {
                        setCustomApiKey(e.target.value);
                        setIsKeySaved(false);
                      }}
                      placeholder="AIzaSy..."
                      className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={() => {
                        localStorage.setItem('CUSTOM_GEMINI_API_KEY', customApiKey);
                        setIsKeySaved(true);
                        setTimeout(() => setIsKeySaved(false), 2000);
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {t('save')}
                    </button>
                  </div>
                  {isKeySaved && (
                    <p className="text-sm text-green-600 mt-2 font-medium">
                      API Key saved successfully!
                    </p>
                  )}
                </div>
                
                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">App Info</h3>
                  <p className="text-sm text-slate-600">Version: 1.0.2</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step: Category */}
          {step === 'category' && (
            <motion.div 
              key="category"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{t('categoryQ')}</h2>
              </div>
              
              <div className="flex flex-wrap items-center justify-center -space-x-4 -space-y-4 max-w-4xl">
                {customCategories.map((cat, i) => (
                  <Bubble 
                    key={cat.id}
                    label={cat.label}
                    color={["bg-blue-400", "bg-indigo-400", "bg-purple-400", "bg-pink-400"][i % 4]}
                    size={i % 2 === 0 ? "w-40 h-40" : "w-32 h-32"}
                    onEdit={(newLabel) => {
                      const newCats = [...customCategories];
                      newCats[i].label = newLabel;
                      setCustomCategories(newCats);
                    }}
                    onClick={() => {
                      setSelection({ ...selection, category: cat.label });
                      setStep('subCategory');
                    }}
                  />
                ))}
              </div>
              
              {/* Type B Input */}
              <div className="w-full max-w-lg mt-12 p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <p className="text-sm font-medium text-slate-500 mb-3">{t('typeBHint')}</p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    placeholder="도서명 또는 URL..."
                    className="flex-1 px-4 py-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button 
                    onClick={startGeneration}
                    disabled={!referenceInput}
                    className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step: SubCategory */}
          {step === 'subCategory' && (
            <motion.div 
              key="subCategory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{selection.category}{t('subCategoryQ')}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-center -space-x-4 -space-y-4 max-w-4xl">
                {customCategories.find(c => c.label === selection.category)?.subCategories.map((sub, i) => (
                  <Bubble 
                    key={sub}
                    label={sub}
                    size={i % 3 === 0 ? "w-36 h-36" : "w-28 h-28"}
                    color="bg-indigo-400"
                    onEdit={(newLabel) => {
                      const newCats = [...customCategories];
                      const catIndex = newCats.findIndex(c => c.label === selection.category);
                      if (catIndex > -1) {
                        newCats[catIndex].subCategories[i] = newLabel;
                        setCustomCategories(newCats);
                      }
                    }}
                    onClick={() => {
                      setSelection({ ...selection, subCategory: sub });
                      setStep('style');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Style */}
          {step === 'style' && (
            <motion.div 
              key="style"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{t('styleQ')}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-center -space-x-6 -space-y-6 max-w-4xl">
                {customStyles.map((style, i) => (
                  <Bubble 
                    key={style.id}
                    label={style.label}
                    color="bg-purple-400"
                    size={i % 2 === 0 ? "w-40 h-40" : "w-32 h-32"}
                    onEdit={(newLabel) => {
                      const newStyles = [...customStyles];
                      newStyles[i].label = newLabel;
                      setCustomStyles(newStyles);
                    }}
                    onClick={() => {
                      setSelection({ ...selection, style: style.label });
                      setStep('vibe');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Vibe */}
          {step === 'vibe' && (
            <motion.div 
              key="vibe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{t('vibeQ')}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-center -space-x-4 -space-y-4 max-w-4xl">
                {customVibes.map((vibe, i) => (
                  <Bubble 
                    key={vibe.id}
                    label={vibe.label}
                    color="bg-pink-400"
                    size={i % 2 === 0 ? "w-36 h-36" : "w-28 h-28"}
                    onEdit={(newLabel) => {
                      const newVibes = [...customVibes];
                      newVibes[i].label = newLabel;
                      setCustomVibes(newVibes);
                    }}
                    onClick={() => {
                      setSelection({ ...selection, vibe: vibe.label });
                      setStep('keywords');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Keywords */}
          {step === 'keywords' && (
            <motion.div 
              key="keywords"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{t('keywordsQ')}</h2>
              </div>
              <textarea
                value={selection.keywords || ''}
                onChange={e => setSelection({...selection, keywords: e.target.value})}
                placeholder={t('keywordsPlaceholder')}
                className="w-full h-40 p-6 rounded-3xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none resize-none text-lg shadow-sm transition-all"
              />
              <button 
                onClick={() => setStep('pages')}
                className="mt-8 px-12 py-4 bg-blue-500 text-white font-black text-xl rounded-full shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2"
              >
                {t('next')} <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {/* Step: Pages (Number Selection) */}
          {step === 'pages' && (
            <motion.div 
              key="pages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <h2 className="text-2xl font-bold text-slate-700 mb-12">{t('pagesQ')}</h2>
              
              <div className="flex items-center gap-6 mb-12">
                <button 
                  onClick={() => setSelection({ ...selection, totalPages: Math.max(1, (selection.totalPages || 10) - 1) })}
                  className="p-4 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
                >
                  <Minus className="w-8 h-8 text-slate-600" />
                </button>
                
                <div className="relative w-48 h-48 rounded-full bg-blue-500 flex flex-col items-center justify-center text-white shadow-2xl border-8 border-white/20">
                  <input 
                    type="number"
                    min="1"
                    value={selection.totalPages || 10}
                    onChange={(e) => setSelection({ ...selection, totalPages: parseInt(e.target.value) || 1 })}
                    className="w-24 bg-transparent text-center text-5xl font-black outline-none border-b-2 border-white/30"
                  />
                  <span className="text-sm font-bold opacity-80 uppercase tracking-widest mt-2">Pages</span>
                </div>

                <button 
                  onClick={() => setSelection({ ...selection, totalPages: (selection.totalPages || 10) + 1 })}
                  className="p-4 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
                >
                  <PlusCircle className="w-8 h-8 text-slate-600" />
                </button>
              </div>

              <p className="mt-8 text-slate-400 font-medium text-center">{t('pagesHint')}</p>
              <button 
                onClick={startGeneration}
                className="mt-6 px-12 py-4 bg-blue-500 text-white font-black text-xl rounded-full shadow-xl hover:bg-blue-600 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Sparkles className="w-6 h-6" />
                {t('createStory')}
              </button>
            </motion.div>
          )}

          {/* Step: Next Vibe Selection */}
          {step === 'nextVibe' && currentStory && (
            <motion.div 
              key="nextVibe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="w-full text-center mb-12">
                <h2 className="text-3xl font-black text-slate-800">{t('nextVibeQ')}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-center -space-x-4 -space-y-4 max-w-4xl">
                {customVibes.map((vibe, i) => (
                  <Bubble 
                    key={vibe.id}
                    label={vibe.label}
                    color="bg-indigo-400"
                    size={i % 2 === 0 ? "w-36 h-36" : "w-28 h-28"}
                    onEdit={(newLabel) => {
                      const newVibes = [...customVibes];
                      newVibes[i].label = newLabel;
                      setCustomVibes(newVibes);
                    }}
                    onClick={() => {
                      generateNextPages(currentStory, selection, currentStory.currentPage, vibe.label);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Translating */}
          {step === 'translating' && (
            <motion.div 
              key="translating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            >
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('translating')}</h2>
            </motion.div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <motion.div 
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: 360
                  }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full"
                />
                <Sparkles className="absolute inset-0 m-auto w-12 h-12 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('generating')}</h2>
              <p className="text-slate-500">{t('generatingDesc')}</p>
            </motion.div>
          )}

          {/* Step: Reading */}
          {step === 'reading' && currentStory && (
            <motion.div 
              key="reading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-4 md:p-8"
            >
              <div className="mb-8 flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">{currentStory.title}</h2>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{currentStory.category}</span>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{currentStory.subCategory}</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">{currentStory.style}</span>
                  </div>
                </div>
                <button 
                  onClick={downloadPDF}
                  className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors text-slate-600"
                  title="PDF"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-12 pb-24">
                {pages.map((page) => (
                  <motion.div 
                    key={page.id}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    className="prose prose-slate max-w-none bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">Page {page.pageNumber}</div>
                    <div className="text-lg leading-relaxed text-slate-700">
                      <ReactMarkdown>
                        {lang === currentStory.language ? page.content : (page.translatedContent || page.content)}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                ))}

                {currentStory.currentPage < currentStory.totalPages && !isGenerating && (
                  <button 
                    onClick={() => setStep('nextVibe')}
                    className="w-full py-6 border-2 border-dashed border-slate-300 rounded-3xl text-slate-500 font-bold hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {t('next10Pages')} ({currentStory.currentPage} / {currentStory.totalPages})
                  </button>
                )}

                {currentStory.currentPage >= currentStory.totalPages && !isGenerating && (
                  <button 
                    onClick={() => {
                      setSelection({
                        ...selection,
                        totalPages: currentStory.totalPages + 10,
                        category: currentStory.category,
                        subCategory: currentStory.subCategory,
                        style: currentStory.style,
                        vibe: currentStory.vibe,
                        keywords: currentStory.keywords,
                      });
                      setStep('pages');
                    }}
                    className="w-full py-6 bg-blue-50 text-blue-600 border-2 border-blue-200 rounded-3xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-5 h-5" />
                    {t('continueStory')}
                  </button>
                )}

                {isGenerating && (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Back Button */}
        {step !== 'category' && step !== 'generating' && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleBack}
            className="fixed bottom-8 left-8 p-4 bg-white rounded-full shadow-xl text-slate-600 hover:text-blue-500 hover:scale-110 transition-all z-50 border border-slate-100"
            title="뒤로가기"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
        )}
      </main>

      {/* Sidebar / History Toggle */}
      {step === 'category' && stories.length > 0 && (
        <div className="p-4 bg-white border-t">
          <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> {t('recent')}
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {stories.map(s => (
              <button 
                key={s.id}
                onClick={() => {
                  setCurrentStory(s);
                  setStep('reading');
                }}
                className="flex-shrink-0 w-40 p-4 bg-slate-100 rounded-2xl text-left hover:bg-blue-50 transition-colors"
              >
                <div className="font-bold text-sm truncate mb-1">{s.title}</div>
                <div className="text-xs text-slate-500">{s.currentPage} / {s.totalPages} P</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
