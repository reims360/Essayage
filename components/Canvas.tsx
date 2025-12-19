/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `useState` from React to enable state management in the component.
import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ShareIcon, CropIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';

interface CanvasProps {
  displayImageUrl: string | null;
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (instruction: string) => void;
  poseInstructions: string[];
  currentPoseInstruction: string;
  availablePoseKeys: string[];
}

// Helper function to get the cropped image data URL
function getCroppedImgDataUrl(image: HTMLImageElement, crop: Crop): string | null {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  if (!crop.width || !crop.height) {
    return null;
  }

  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL('image/jpeg', 0.9);
}


const Canvas: React.FC<CanvasProps> = ({ displayImageUrl, onStartOver, isLoading, loadingMessage, onSelectPose, poseInstructions, currentPoseInstruction, availablePoseKeys }) => {
  const [isPoseMenuOpen, setIsPoseMenuOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [customPoseInput, setCustomPoseInput] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);

  const imageToDisplay = croppedImageUrl ?? displayImageUrl;

  // Reset crop when the base image changes (e.g., new pose or garment)
  useEffect(() => {
    setCroppedImageUrl(null);
    setCrop(undefined);
  }, [displayImageUrl]);
  
  const handlePreviousPose = () => {
    if (isLoading) return;
    const currentIndex = poseInstructions.indexOf(currentPoseInstruction);
    // If custom pose, jump to the end of the default list
    const newIndex = currentIndex === -1 
      ? poseInstructions.length - 1 
      : (currentIndex - 1 + poseInstructions.length) % poseInstructions.length;
    onSelectPose(poseInstructions[newIndex]);
  };

  const handleNextPose = () => {
    if (isLoading) return;
    const currentIndex = poseInstructions.indexOf(currentPoseInstruction);
     // If custom pose, jump to the beginning of the default list
    const newIndex = currentIndex === -1 
      ? 0
      : (currentIndex + 1) % poseInstructions.length;
    onSelectPose(poseInstructions[newIndex]);
  };

  const handleCustomPoseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !customPoseInput.trim()) return;
    onSelectPose(customPoseInput.trim());
    setCustomPoseInput('');
    setIsPoseMenuOpen(false);
  }

  const handleDownload = () => {
    if (!imageToDisplay) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw a white background for any transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.href = jpegUrl;
        link.download = 'mon-look.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    image.src = imageToDisplay;
  };

  const handleShare = async () => {
    if (!imageToDisplay || !navigator.share) return;

    try {
      const response = await fetch(imageToDisplay);
      const blob = await response.blob();
      
      const file = new File([blob], 'mon-look.jpg', { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Mon Look Virtuel',
          text: 'Découvrez ma nouvelle tenue créée avec l\'Essayage Virtuel !',
          files: [file],
        });
      } else {
        // Fallback for browsers that can't share files
        handleDownload();
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Erreur de partage:', error);
        handleDownload(); // Fallback to download on error
      }
    }
  };

  const handleConfirmCrop = () => {
    if (!crop || !imgRef.current) {
      return;
    }
    const croppedDataUrl = getCroppedImgDataUrl(imgRef.current, crop);
    if (croppedDataUrl) {
      setCroppedImageUrl(croppedDataUrl);
    }
    setIsCropping(false);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCrop(undefined);
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in group">
      {/* Action Buttons */}
      <div className="absolute top-4 left-4 z-30">
        <button 
            onClick={onStartOver}
            className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
        >
            <RotateCcwIcon className="w-4 h-4 mr-2" />
            Recommencer
        </button>
      </div>

      {displayImageUrl && !isLoading && !isCropping && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            <button
                onClick={() => setIsCropping(true)}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
            >
                <CropIcon className="w-4 h-4 mr-2" />
                Recadrer
            </button>
            <button
                onClick={handleShare}
                disabled={!navigator.share}
                title={!navigator.share ? "Partage non supporté sur ce navigateur" : "Partager la tenue"}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ShareIcon className="w-4 h-4 mr-2" />
                Partager
            </button>
            <button
                onClick={handleDownload}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
            >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Télécharger
            </button>
        </div>
      )}


      {/* Image Display or Placeholder */}
      <div className="relative w-full h-full flex items-center justify-center">
        {isCropping ? (
           <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            aspect={undefined}
            className="max-w-full max-h-full"
          >
            <img
              ref={imgRef}
              src={displayImageUrl!} // Should exist if we're cropping
              alt="Modèle d'essayage virtuel à recadrer"
              className="max-w-full max-h-full object-contain"
              decoding="async"
              onLoad={(e) => {
                const { width, height } = e.currentTarget;
                // Default to an American shot (knees up)
                const americanShotCrop: Crop = {
                  unit: 'px',
                  x: 0,
                  y: 0,
                  width: width,
                  height: height * 0.7 // Crop to ~70% height from the top
                };
                setCrop(americanShotCrop);
              }}
            />
          </ReactCrop>
        ) : imageToDisplay ? (
          <img
            key={imageToDisplay} // Use key to force re-render and trigger animation on image change
            src={imageToDisplay}
            alt="Modèle d'essayage virtuel"
            className="max-w-full max-h-full object-contain transition-opacity duration-500 animate-fade-in rounded-lg"
            decoding="async"
          />
        ) : (
            <div className="w-[400px] h-[600px] bg-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center">
              <Spinner />
              <p className="text-md font-serif text-gray-600 mt-4">Chargement du modèle...</p>
            </div>
        )}
        
        <AnimatePresence>
          {isLoading && !isCropping && (
              <motion.div
                  className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
              >
                  <Spinner />
                  {loadingMessage && (
                      <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isCropping && (
        <div className="absolute inset-0 bg-black/50 z-40 flex flex-col items-center justify-end pb-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleCancelCrop}
                    className="px-6 py-3 text-base font-semibold text-gray-800 bg-white rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
                >
                    Annuler
                </button>
                <button
                    onClick={handleConfirmCrop}
                    disabled={!crop?.width || !crop?.height}
                    className="px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Confirmer
                </button>
            </div>
        </div>
      )}

      {/* Pose Controls */}
      {displayImageUrl && !isLoading && !isCropping && (
        <div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onMouseEnter={() => setIsPoseMenuOpen(true)}
          onMouseLeave={() => setIsPoseMenuOpen(false)}
        >
          {/* Pose popover menu */}
          <AnimatePresence>
              {isPoseMenuOpen && (
                  <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute bottom-full mb-3 w-72 bg-white/80 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80"
                  >
                      <div className="grid grid-cols-2 gap-2">
                          {poseInstructions.map((pose) => (
                              <button
                                  key={pose}
                                  onClick={() => onSelectPose(pose)}
                                  disabled={isLoading || pose === currentPoseInstruction}
                                  className="w-full text-left text-sm font-medium text-gray-800 p-2 rounded-md hover:bg-gray-200/70 disabled:opacity-50 disabled:bg-gray-200/70 disabled:font-bold disabled:cursor-not-allowed"
                              >
                                  {pose}
                              </button>
                          ))}
                      </div>
                      <form onSubmit={handleCustomPoseSubmit} className="mt-2 pt-2 border-t border-gray-200/80">
                        <label htmlFor="custom-pose-input" className="sr-only">Instruction de pose personnalisée</label>
                        <div className="relative">
                          <input
                            id="custom-pose-input"
                            type="text"
                            value={customPoseInput}
                            onChange={(e) => setCustomPoseInput(e.target.value)}
                            placeholder="Décrivez une pose..."
                            className="w-full bg-gray-100/80 border border-gray-300 rounded-md p-2 pr-20 text-sm focus:ring-1 focus:ring-gray-800 focus:border-gray-800"
                            disabled={isLoading}
                          />
                          <button
                            type="submit"
                            disabled={isLoading || !customPoseInput.trim()}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-semibold bg-gray-800 text-white px-3 py-1 rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Générer
                          </button>
                        </div>
                      </form>
                  </motion.div>
              )}
          </AnimatePresence>
          
          <div className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md rounded-full p-2 border border-gray-300/50">
            <button 
              onClick={handlePreviousPose}
              aria-label="Pose précédente"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-800" />
            </button>
            <span className="text-sm font-semibold text-gray-800 w-48 text-center truncate" title={currentPoseInstruction}>
              {currentPoseInstruction}
            </span>
            <button 
              onClick={handleNextPose}
              aria-label="Pose suivante"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
