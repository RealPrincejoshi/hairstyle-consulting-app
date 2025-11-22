export interface HairstyleSuggestion {
  name: string;
  description: string;
  reasoning: string;
}

export interface AnalysisResult {
  faceShape: string;
  suggestions: HairstyleSuggestion[];
}

export interface GeneratedImage {
  hairstyleName: string;
  imageUrl: string;
}

export enum AppState {
  IDLE = 'IDLE',
  CAMERA = 'CAMERA',
  PREVIEW = 'PREVIEW',
  ANALYZING = 'ANALYZING',
  SELECTION = 'SELECTION',
  GENERATING = 'GENERATING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}