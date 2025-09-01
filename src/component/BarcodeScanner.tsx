import React, { useState, useEffect, useRef, useCallback } from 'react';
import "./../index.css"
import type { ApiResponse, ScannedItem } from '../types';


const BarcodeScanner: React.FC = () => {
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, []);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const barcode = barcodeInput.trim();
      
      if (barcode) {
        await processBarcode(barcode);
      }
    }
  }, [barcodeInput]);

  // Process barcode scan
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
      <h1>Barcode Scanner POC (TypeScript)</h1>
      
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

export default BarcodeScanner;