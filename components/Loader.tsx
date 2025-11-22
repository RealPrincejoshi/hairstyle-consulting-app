import React from 'react';

interface LoaderProps {
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({ text }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-white rounded-full animate-spin"></div>
        <div className="absolute top-1 left-1 w-14 h-14 border-r-2 border-b-2 border-zinc-600 rounded-full animate-spin reverse"></div>
      </div>
      {text && <p className="text-zinc-400 text-sm tracking-widest animate-pulse">{text}</p>}
    </div>
  );
};

export default Loader;
