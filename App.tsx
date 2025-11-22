import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, RefreshCwIcon, CheckIcon, SparklesIcon, XIcon, DownloadIcon } from './components/Icons';
import Loader from './components/Loader';
import { analyzeFace, generateHairstyleImage } from './services/geminiService';
import { AppState, AnalysisResult, GeneratedImage } from './types';

const App: React.FC = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Now storing multiple images: [Front, Left, Right]
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [captureStep, setCaptureStep] = useState<number>(0); // 0: Front, 1: Left, 2: Right

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Camera Logic ---

  const startCamera = useCallback(async () => {
    try {
      setAppState(AppState.CAMERA);
      setCaptureStep(0);
      setCapturedImages([]);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setErrorMsg("Could not access camera. Please ensure permissions are granted.");
      setAppState(AppState.ERROR);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Flip horizontally for mirror effect if needed, but usually better to keep raw for analysis
        // Drawing raw image
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        setCapturedImages(prev => {
          const newImages = [...prev, dataUrl];
          
          // If we just took the 3rd photo (index 2)
          if (newImages.length === 3) {
            stopCamera();
            setAppState(AppState.PREVIEW);
          } else {
            // Move to next step
            setCaptureStep(prevStep => prevStep + 1);
          }
          return newImages;
        });
      }
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImages([]);
    setCaptureStep(0);
    setAnalysisResult(null);
    setGeneratedImages([]);
    startCamera();
  }, [startCamera]);

  const resetApp = useCallback(() => {
    setCapturedImages([]);
    setCaptureStep(0);
    setAnalysisResult(null);
    setGeneratedImages([]);
    setSelectedIndices([]);
    setAppState(AppState.IDLE);
    stopCamera();
  }, [stopCamera]);

  // --- Analysis & Generation Logic ---

  const performAnalysis = useCallback(async () => {
    if (capturedImages.length === 0) return;

    try {
      // 1. Analyze (Send all 3 images)
      setAppState(AppState.ANALYZING);
      const analysis = await analyzeFace(capturedImages);
      setAnalysisResult(analysis);
      setSelectedIndices([]); // Reset selection
      setAppState(AppState.SELECTION); // Move to selection screen
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setErrorMsg(err.message || "Failed to analyze face.");
      setAppState(AppState.ERROR);
    }
  }, [capturedImages]);

  const toggleSelection = (index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        if (prev.length >= 2) return prev; // Max 2
        return [...prev, index];
      }
    });
  };

  const generateSelected = useCallback(async () => {
    if (!analysisResult || selectedIndices.length === 0) return;

    try {
      setAppState(AppState.GENERATING);
      const frontImage = capturedImages[0];
      
      // Filter suggestions based on selection
      const selectedSuggestions = analysisResult.suggestions.filter((_, idx) => selectedIndices.includes(idx));

      // Generate images in parallel
      const promises = selectedSuggestions.map(async (suggestion) => {
        const url = await generateHairstyleImage(frontImage, suggestion.name, suggestion.description);
        return { hairstyleName: suggestion.name, imageUrl: url };
      });

      const images = await Promise.all(promises);
      setGeneratedImages(images);
      setAppState(AppState.RESULTS);

    } catch (err: any) {
      console.error("Generation failed:", err);
      setErrorMsg(err.message || "Failed to generate images.");
      setAppState(AppState.ERROR);
    }
  }, [analysisResult, selectedIndices, capturedImages]);

  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // --- Cleanup ---
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);


  // --- Renders ---

  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center px-6">
      <div className="mb-8 p-6 rounded-full bg-zinc-900 border border-zinc-800 shadow-2xl shadow-zinc-900/50">
        <SparklesIcon className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-4">
        Style<span className="font-semibold">AI</span>
      </h1>
      <p className="text-zinc-400 max-w-md text-lg font-light mb-12">
        Discover your perfect look. We analyze your face shape from 3 angles to visualize tailored hairstyles instantly.
      </p>
      <button
        onClick={startCamera}
        className="group relative px-8 py-4 bg-white text-black font-medium rounded-full overflow-hidden transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
      >
        <span className="relative z-10 flex items-center gap-2">
          <CameraIcon className="w-5 h-5" />
          Start Analysis
        </span>
      </button>
    </div>
  );

  const renderCamera = () => {
    const instructions = [
      { text: "Front View", sub: "Look straight at the camera" },
      { text: "Left Profile", sub: "Turn your head slightly to the right" },
      { text: "Right Profile", sub: "Turn your head slightly to the left" }
    ];
    
    const currentInstruction = instructions[captureStep];

    return (
      <div className="relative h-[100dvh] w-full bg-black overflow-hidden flex flex-col">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="flex-1 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Visual Guide Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           {/* Face Guide Oval */}
           <div className="w-64 h-80 md:w-80 md:h-96 rounded-[50%] border-2 border-white/40 shadow-[0_0_100px_rgba(0,0,0,0.5)_inset] bg-transparent backdrop-grayscale-0" />
        </div>

        {/* Top Instructions */}
        <div className="absolute top-0 left-0 w-full pt-12 pb-6 flex flex-col items-center bg-gradient-to-b from-black/80 to-transparent z-10">
           <div className="flex gap-2 mb-3">
             {[0, 1, 2].map(step => (
               <div key={step} className={`w-2 h-2 rounded-full transition-colors ${step === captureStep ? 'bg-white' : step < captureStep ? 'bg-green-500' : 'bg-zinc-600'}`} />
             ))}
           </div>
           <h2 className="text-2xl font-semibold text-white drop-shadow-md">{currentInstruction.text}</h2>
           <p className="text-zinc-300 text-sm drop-shadow-md">{currentInstruction.sub}</p>
        </div>
        
        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 w-full p-10 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent z-10 safe-area-pb">
          <button
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform hover:scale-95 active:scale-90"
            aria-label="Take Photo"
          >
             <div className="w-16 h-16 bg-white rounded-full" />
          </button>
        </div>
        
        <button 
          onClick={resetApp}
          className="absolute top-6 right-6 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 z-20"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
    );
  };

  const renderPreview = () => (
    <div className="min-h-[100dvh] flex flex-col bg-zinc-950">
      <div className="flex-1 overflow-hidden p-6 flex flex-col items-center justify-center gap-6">
         <h2 className="text-xl font-light text-zinc-300">Review Capture</h2>
         
         {/* Main Image (Front) */}
         <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
           {capturedImages[0] && (
             <img 
               src={capturedImages[0]} 
               alt="Front View" 
               className="w-full h-full object-cover" 
             />
           )}
           <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">Front</div>
         </div>

         {/* Side Images */}
         <div className="flex gap-4">
            <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-zinc-800 opacity-80">
               {capturedImages[1] && <img src={capturedImages[1]} alt="Left" className="w-full h-full object-cover" />}
               <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">Left</div>
            </div>
            <div className="relative w-24 h-32 rounded-lg overflow-hidden border border-zinc-800 opacity-80">
               {capturedImages[2] && <img src={capturedImages[2]} alt="Right" className="w-full h-full object-cover" />}
               <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">Right</div>
            </div>
         </div>
      </div>
      
      <div className="p-8 bg-zinc-900 border-t border-zinc-800 flex justify-center gap-6 safe-area-pb">
        <button
          onClick={retakePhoto}
          className="flex-1 max-w-[160px] py-3 px-6 rounded-lg border border-zinc-600 text-zinc-300 font-medium hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCwIcon className="w-4 h-4" />
          Retake
        </button>
        <button
          onClick={performAnalysis}
          className="flex-1 max-w-[160px] py-3 px-6 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
        >
          <CheckIcon className="w-4 h-4" />
          Analyze
        </button>
      </div>
    </div>
  );

  const renderSelection = () => {
    if (!analysisResult) return null;

    const canGenerate = selectedIndices.length > 0 && selectedIndices.length <= 2;

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
           <div>
             <h2 className="text-xl font-medium">Select Styles</h2>
             <p className="text-xs text-zinc-400">Choose 1 or 2 styles to generate</p>
           </div>
           <div className="text-sm font-medium bg-zinc-800 px-3 py-1 rounded-full">
             {selectedIndices.length} / 2 Selected
           </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto p-6 w-full">
           <div className="mb-6 text-center">
             <h3 className="text-2xl font-light text-zinc-200 mb-2">
               Your face shape is <span className="text-white font-normal">{analysisResult.faceShape}</span>
             </h3>
             <p className="text-zinc-500">We found 5 styles that match your features perfectly.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
             {analysisResult.suggestions.map((suggestion, index) => {
               const isSelected = selectedIndices.includes(index);
               const isDisabled = !isSelected && selectedIndices.length >= 2;

               return (
                 <div 
                    key={index}
                    onClick={() => !isDisabled && toggleSelection(index)}
                    className={`
                      relative p-6 rounded-xl cursor-pointer transition-all duration-200 border-2
                      ${isSelected 
                        ? 'bg-zinc-900 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                        : isDisabled 
                          ? 'bg-zinc-900/30 border-zinc-800 opacity-50 cursor-not-allowed'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900'
                      }
                    `}
                 >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-medium text-white">{suggestion.name}</h4>
                      <div className={`
                        w-6 h-6 rounded border flex items-center justify-center transition-colors
                        ${isSelected ? 'bg-white border-white' : 'border-zinc-600 bg-transparent'}
                      `}>
                        {isSelected && <CheckIcon className="w-4 h-4 text-black" />}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300 mb-4 leading-relaxed">{suggestion.description}</p>
                    <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-3 mt-auto">
                      <span className="uppercase tracking-wider font-semibold text-zinc-600 block mb-1">Match Reason</span>
                      {suggestion.reasoning}
                    </div>
                 </div>
               );
             })}
           </div>
        </main>

        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pointer-events-none safe-area-pb">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={generateSelected}
              disabled={!canGenerate}
              className={`
                w-full py-4 rounded-full font-medium text-lg transition-all flex items-center justify-center gap-3 shadow-lg
                ${canGenerate 
                  ? 'bg-white text-black hover:scale-105 active:scale-95' 
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
              `}
            >
              <SparklesIcon className="w-5 h-5" />
              Generate Visualizations
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-zinc-950">
      <Loader text={appState === AppState.ANALYZING ? "ANALYZING FACE GEOMETRY..." : "GENERATING YOUR LOOK..."} />
    </div>
  );

  const renderResults = () => {
    if (!analysisResult) return null;

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 pb-20">
        <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
          <h2 className="text-xl font-light">Your New Look</h2>
          <button onClick={resetApp} className="text-sm text-zinc-400 hover:text-white">Start Over</button>
        </header>

        <main className="max-w-5xl mx-auto p-6 space-y-12">
          
          <section className="text-center space-y-4 animate-fade-in-up">
             <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
               Here are the AI-generated visualizations for your selected hairstyles.
             </p>
          </section>

          {/* Comparison Grid */}
          <div className={`grid grid-cols-1 ${generatedImages.length > 1 ? 'lg:grid-cols-2' : 'max-w-md mx-auto'} gap-12`}>
            {generatedImages.map((generated, idx) => {
               const suggestion = analysisResult.suggestions.find(s => s.name === generated.hairstyleName);
               
               return (
                 <div key={idx} className="group bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl hover:border-zinc-700 transition-all duration-500">
                    <div className="aspect-[4/5] relative bg-zinc-800 overflow-hidden">
                      <img 
                        src={generated.imageUrl} 
                        alt={generated.hairstyleName}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <button
                        onClick={() => downloadImage(generated.imageUrl, `styleai-${generated.hairstyleName.replace(/\s+/g, '-').toLowerCase()}.png`)}
                        className="absolute top-4 right-4 p-3 bg-black/30 backdrop-blur-md text-white rounded-full border border-white/10 transition-all duration-300 hover:bg-white hover:text-black hover:scale-110 active:scale-95"
                        title="Download Image"
                      >
                        <DownloadIcon className="w-5 h-5" />
                      </button>
                      
                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20 pointer-events-none">
                        <h3 className="text-2xl font-semibold text-white mb-1">{generated.hairstyleName}</h3>
                        <p className="text-sm text-zinc-300 font-light opacity-90">{suggestion?.description}</p>
                      </div>
                    </div>
                    {suggestion && (
                      <div className="p-6">
                        <h4 className="text-xs uppercase tracking-widest text-zinc-500 mb-2 font-semibold">Why it works</h4>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          {suggestion.reasoning}
                        </p>
                      </div>
                    )}
                 </div>
               );
            })}
          </div>
          
          <div className="flex justify-center pt-8 safe-area-pb">
            <button
               onClick={resetApp}
               className="px-8 py-3 border border-zinc-700 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
             >
               Try Another Photo
             </button>
          </div>

        </main>
      </div>
    );
  };

  const renderError = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-950 text-center p-8">
      <div className="text-red-400 mb-4">
        <XIcon className="w-12 h-12 mx-auto" />
      </div>
      <h3 className="text-xl text-white font-medium mb-2">Something went wrong</h3>
      <p className="text-zinc-500 max-w-md mb-8">{errorMsg}</p>
      <button
        onClick={resetApp}
        className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200"
      >
        Try Again
      </button>
    </div>
  );

  // Main Render Switch
  switch (appState) {
    case AppState.IDLE: return renderIdle();
    case AppState.CAMERA: return renderCamera();
    case AppState.PREVIEW: return renderPreview();
    case AppState.ANALYZING: return renderLoading();
    case AppState.SELECTION: return renderSelection();
    case AppState.GENERATING: return renderLoading();
    case AppState.RESULTS: return renderResults();
    case AppState.ERROR: return renderError();
    default: return renderIdle();
  }
};

export default App;