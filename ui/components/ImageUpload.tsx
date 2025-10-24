'use client';

import { useState, useRef, DragEvent } from 'react';
import Image from 'next/image';

interface ImageUploadProps {
  onImageUpload: (url: string) => void;
  currentImage?: string;
  name?: string;
}

export function ImageUpload({ onImageUpload, currentImage, name = 'token' }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string>(currentImage || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);


  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Set effect to copy
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    // Try to get file from items first, then fallback to files
    let file: File | null = null;
    let imageUrl: string | null = null;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      // First, check for files
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];

        if (item.kind === 'file') {
          file = item.getAsFile();
          if (file) break;
        }
      }

      // If no file, check for URL (image dragged from web)
      if (!file) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];

          if (item.kind === 'string' && item.type === 'text/uri-list') {
            await new Promise<void>((resolve) => {
              item.getAsString((url) => {
                imageUrl = url;
                resolve();
              });
            });
            break;
          }
        }
      }
    }

    // Fallback to files if no file found in items
    if (!file && !imageUrl && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    }

    // Handle URL-based image (dragged from web)
    if (!file && imageUrl) {
      try {
        // Fetch the image from URL
        setIsUploading(true);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();

        // Check if it's an image
        if (!blob.type.startsWith('image/')) {
          alert('The dragged URL does not appear to be an image');
          setIsUploading(false);
          return;
        }

        // Convert blob to File
        const filename = (imageUrl as string).split('/').pop()?.split('?')[0] || 'image.jpg';
        file = new File([blob], filename, { type: blob.type });
      } catch (error) {
        console.error('Failed to fetch image from URL:', error);
        alert('Failed to fetch image from URL. This may be due to CORS restrictions. Try downloading the image and uploading it directly.');
        setIsUploading(false);
        return;
      }
    }

    if (!file) {
      return;
    }

    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Check file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedImage(data.url);
      onImageUpload(data.url);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onClick={triggerFileInput}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative w-[200px] h-[200px] border-2 border-dashed rounded-lg
          transition-all duration-200 cursor-pointer overflow-hidden
          ${isDragging ? 'border-white bg-white/10 scale-105' : 'border-gray-800 hover:border-gray-600'}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploadedImage ? (
          <div className="relative w-full h-full group">
            <Image
              src={uploadedImage}
              alt="Uploaded"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-sm font-medium">Click to replace</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {isUploading ? (
              <>
                <div className="w-8 h-8 border-2 border-gray-400 border-t-white rounded-full animate-spin mb-2" />
                <p className="text-gray-300 text-sm">Uploading...</p>
              </>
            ) : (
              <>
                <svg
                  className="w-8 h-8 text-gray-300 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="text-gray-300 text-lg text-center">
                  {isDragging ? 'Token Image*' : 'Token Image*'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}