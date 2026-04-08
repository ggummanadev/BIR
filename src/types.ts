export interface User {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: any;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  category?: string;
  subCategory?: string;
  style?: string;
  vibe?: string;
  tone?: string;
  keywords?: string;
  language: 'ko' | 'en';
  totalPages: number;
  currentPage: number;
  createdAt: any;
  isCompleted: boolean;
  referenceBooks?: string[];
  coverUrl?: string;
  summary?: string;
}

export interface Page {
  id: string;
  storyId: string;
  pageNumber: number;
  content: string;
  translatedContent?: string;
  createdAt: any;
}

export type SelectionStep = 'category' | 'subCategory' | 'style' | 'vibe' | 'tone' | 'keywords' | 'pages' | 'generating' | 'reading' | 'library' | 'nextVibe' | 'translating' | 'settings';

export interface SelectionState {
  category?: string;
  subCategory?: string;
  style?: string;
  vibe?: string;
  tone?: string;
  keywords?: string;
  totalPages?: number;
  referenceInput?: string;
  title?: string;
  summary?: string;
}
