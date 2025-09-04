import React, { useState, useEffect, useRef, useCallback } from 'react';
import "./../index.css"
import type { ApiResponse, ScannedItem } from '../types';
import { BarcodeDetectionService } from '../services/barcodeDetectionService';

interface BarcodeDetectionResult {
  success: boolean;
  barcode?: string;
  error?: string;
  format?: string;
}

const BarcodeScannerWithAPI: React.FC = () => {
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanMode, setScanMode] = useState<'manual' | 'camera' | 'upload'>('manual');
  const [cameraInitialized, setCameraInitialized] = useState<boolean>(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && scanMode === 'manual') {
      inputRef.current.focus();
    }
  }, [scanMode]);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    return () => {
      BarcodeDetectionService.cleanup();
    };
  }, []);

  const handleBarcodeScan = useCallback(async (event: React.KeyboardEvent<HTMLInputElement>) =>   {
    if (event.key === 'Enter') {
      event.preventDefault();
      const barcode = barcodeInput.trim();
      
      if (barcode) {
        await processBarcode(barcode);
      }
    }
  }, [barcodeInput]);

  const processBarcode = async (barcode: string): Promise<void> => {
    setIsLoading(true);
    setMessage(`Processing barcode: ${barcode}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode }),
      });

      const result: ApiResponse<ScannedItem> = await response.json();

      if (response.ok && result.data) {
        setScannedItems(prev => [result.data!, ...prev]);
        setBarcodeInput('');
        setMessage(`Scanned: ${result.data.name}`);
      } else {
        setMessage(result.error || 'Error processing barcode');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Network error - is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async (): Promise<void> => {
    try {
      setMessage('Initializing camera...');
      
      const success = await BarcodeDetectionService.initializeCamera('camera-container');
      if (success) {
        setCameraInitialized(true);
        setCameraActive(true);
        setMessage('Camera started. Point at a barcode to scan.');
        
        // Start detection
        BarcodeDetectionService.startCameraDetection((result: BarcodeDetectionResult) => {
          if (result.success && result.barcode) {
            console.log('📱 Camera detected barcode:', result.barcode);
            processBarcode(result.barcode);
          }
        });
      } else {
        setMessage('Failed to initialize camera. Please check permissions.');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setMessage('Error accessing camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = (): void => {
    BarcodeDetectionService.stopCameraDetection();
    setCameraActive(false);
    setCameraInitialized(false);
    setMessage('');
  };

  // Capture image from camera and scan
  const captureAndScan = async (): Promise<void> => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setIsLoading(true);
    setMessage('Scanning captured image...');

    try {
      const result = await BarcodeDetectionService.detectFromCanvas(canvas);
      
      if (result.success && result.barcode) {
        await processBarcode(result.barcode);
      } else {
        setMessage(result.error || 'No barcode found in image');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error processing camera image');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMessage(`Selected: ${file.name}`);
    }
  };

  // Upload and scan image file
  const uploadAndScan = async (): Promise<void> => {
    if (!selectedFile) {
      setMessage('Please select an image file first');
      return;
    }

    setIsLoading(true);
    setMessage('Scanning image...');

    try {
      const result = await BarcodeDetectionService.detectFromImageFile(selectedFile);
      
      if (result.success && result.barcode) {
        await processBarcode(result.barcode);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setMessage(result.error || 'No barcode found in image');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error processing image');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all scanned items
  const fetchItems = async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:5000/api/items');
      const result: ApiResponse<ScannedItem[]> = await response.json();
      
      if (response.ok && result.data) {
        setScannedItems(result.data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  // Clear all items
  const clearItems = async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:5000/api/items', {
        method: 'DELETE',
      });
      
      const result: ApiResponse = await response.json();
      
      if (response.ok) {
        setScannedItems([]);
        setMessage(result.message || 'All items cleared');
      }
    } catch (error) {
      console.error('Error clearing items:', error);
    }
  };

  return (
    <div className="scanner-container">
      <h1>Barcode Scanner with API Detection</h1>
      
      {/* Scan Mode Selection */}
      <div className="scan-modes">
        <button 
          className={scanMode === 'manual' ? 'active' : ''} 
          onClick={() => setScanMode('manual')}
        >
          Manual Input
        </button>
        <button 
          className={scanMode === 'camera' ? 'active' : ''} 
          onClick={() => setScanMode('camera')}
        >
          Camera Scan
        </button>
        <button 
          className={scanMode === 'upload' ? 'active' : ''} 
          onClick={() => setScanMode('upload')}
        >
          Upload Image
        </button>
      </div>

      {/* Manual Input Mode */}
      {scanMode === 'manual' && (
        <div className="scanner-box">
          <label htmlFor="barcode-input">Scan Barcode: </label>
          <input
            ref={inputRef}
            id="barcode-input"
            type="text"
            value={barcodeInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBarcodeInput(e.target.value)}
            onKeyPress={handleBarcodeScan}
            placeholder="Focus here and scan a barcode"
            disabled={isLoading}
            autoComplete="off"
          />
          
          <div className="instructions">
            <p>To simulate scanning:</p>
            <ul>
              <li>Type one of these barcodes: 5901234123457, 5012345678900, 1234567890128</li>
              <li>Press <kbd>Enter</kbd></li>
            </ul>
          </div>
        </div>
      )}

      {/* Camera Mode */}
      {scanMode === 'camera' && (
        <div className="camera-box">
          <div className="camera-controls">
            {!cameraActive ? (
              <button onClick={startCamera} disabled={isLoading}>
                Start Camera
              </button>
            ) : (
              <div>
                <button onClick={captureAndScan} disabled={isLoading}>
                  Capture & Scan
                </button>
                <button onClick={stopCamera} className="stop-btn">
                  Stop Camera
                </button>
              </div>
            )}
          </div>
          
          {cameraActive && (
            <div className="camera-preview">
              <div id="camera-container" style={{ width: '100%', maxWidth: '640px', height: '480px' }} />
              <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      )}

      {/* Upload Mode */}
      {scanMode === 'upload' && (
        <div className="upload-box">
          <div className="file-input">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isLoading}
            />
            <button onClick={uploadAndScan} disabled={!selectedFile || isLoading}>
              Upload & Scan
            </button>
          </div>
          
          {selectedFile && (
            <div className="selected-file">
              <p>Selected: {selectedFile.name}</p>
            </div>
          )}
        </div>
      )}

      {message && <div className="message">{message}</div>}

      <div className="actions">
        <button onClick={fetchItems} disabled={isLoading}>
          Refresh List
        </button>
        <button onClick={clearItems} disabled={isLoading} className="clear-btn">
          Clear All
        </button>
      </div>

      <div className="results">
        <h2>Scanned Items ({scannedItems.length})</h2>
        
        {scannedItems.length === 0 ? (
          <p>No items scanned yet.</p>
        ) : (
          <div className="items-list">
            {scannedItems.map(item => (
              <div key={item.id} className="item-card">
                <div className="item-info">
                  <h3>{item.name}</h3>
                  <p>Barcode: {item.barcode}</p>
                  <p>Price: ${item.price.toFixed(2)}</p>
                </div>
                <div className="item-meta">
                  <span>Scanned at: {item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerWithAPI;
