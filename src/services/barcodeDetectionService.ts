import Quagga from 'quagga';
import jsQR from 'jsqr';

export interface BarcodeDetectionResult {
  success: boolean;
  barcode?: string;
  error?: string;
  format?: string;
}

export class BarcodeDetectionService {
  private static isInitialized = false;

  /**
   * Initialize Quagga for camera barcode detection
   */
  static async initializeCamera(elementId: string): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      return new Promise((resolve, reject) => {
        Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector(`#${elementId}`) as HTMLElement,
            constraints: {
              width: 640,
              height: 480,
              facingMode: "environment" // Use back camera
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true
          },
          numOfWorkers: 2,
          frequency: 10,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "ean_8_reader",
              "code_39_reader",
              "code_39_vin_reader",
              "codabar_reader",
              "upc_reader",
              "upc_e_reader",
              "i2of5_reader"
            ]
          },
          locate: true
        }, (err: any) => {
          if (err) {
            console.error('Quagga initialization error:', err);
            reject(err);
            return;
          }
          console.log("✅ Quagga initialized successfully");
          this.isInitialized = true;
          resolve(true);
        });
      });
    } catch (error) {
      console.error('Error initializing Quagga:', error);
      return false;
    }
  }

  /**
   * Start camera barcode detection
   */
  static startCameraDetection(onDetected: (result: BarcodeDetectionResult) => void): void {
    if (!this.isInitialized) {
      onDetected({
        success: false,
        error: 'Camera not initialized'
      });
      return;
    }

    Quagga.start();

    Quagga.onDetected((data: any) => {
      const code = data.codeResult.code;
      const format = data.codeResult.format;
      
      console.log('📱 Barcode detected:', code, 'Format:', format);
      
      onDetected({
        success: true,
        barcode: code,
        format: format
      });
    });
  }

  /**
   * Stop camera barcode detection
   */
  static stopCameraDetection(): void {
    if (this.isInitialized) {
      Quagga.stop();
      Quagga.offDetected();
    }
  }

  /**
   * Detect barcode from image file
   */
  static async detectFromImageFile(file: File): Promise<BarcodeDetectionResult> {
    try {
      console.log('📁 Detecting barcode from image file:', file.name);
      
      // Create image element
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return {
          success: false,
          error: 'Could not get canvas context'
        };
      }

      return new Promise((resolve) => {
        img.onload = () => {
          // Set canvas size to image size
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Try QR code detection first
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrCode && qrCode.data) {
            console.log('✅ QR Code detected:', qrCode.data);
            resolve({
              success: true,
              barcode: qrCode.data,
              format: 'QR_CODE'
            });
            return;
          }
          
          // Try Quagga for traditional barcodes
          Quagga.decodeSingle({
            src: canvas.toDataURL(),
            numOfWorkers: 0,
            inputStream: {
              size: 800
            },
            decoder: {
              readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "upc_reader",
                "upc_e_reader"
              ]
            },
            locate: true
          }, (result: any) => {
            if (result && result.codeResult) {
              console.log('✅ Barcode detected:', result.codeResult.code, 'Format:', result.codeResult.format);
              resolve({
                success: true,
                barcode: result.codeResult.code,
                format: result.codeResult.format
              });
            } else {
              console.log('❌ No barcode detected in image');
              resolve({
                success: false,
                error: 'No barcode detected in image'
              });
            }
          });
        };
        
        img.onerror = () => {
          resolve({
            success: false,
            error: 'Could not load image'
          });
        };
        
        // Load image
        img.src = URL.createObjectURL(file);
      });
      
    } catch (error) {
      console.error('Error detecting barcode from image:', error);
      return {
        success: false,
        error: 'Failed to process image'
      };
    }
  }

  /**
   * Detect barcode from camera capture (canvas)
   */
  static async detectFromCanvas(canvas: HTMLCanvasElement): Promise<BarcodeDetectionResult> {
    try {
      console.log('📷 Detecting barcode from canvas');
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return {
          success: false,
          error: 'Could not get canvas context'
        };
      }

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try QR code detection first
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      if (qrCode && qrCode.data) {
        console.log('✅ QR Code detected from canvas:', qrCode.data);
        return {
          success: true,
          barcode: qrCode.data,
          format: 'QR_CODE'
        };
      }
      
      // Try Quagga for traditional barcodes
      return new Promise((resolve) => {
        Quagga.decodeSingle({
          src: canvas.toDataURL(),
          numOfWorkers: 0,
          inputStream: {
            size: 800
          },
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "ean_8_reader",
              "code_39_reader",
              "upc_reader",
              "upc_e_reader"
            ]
          },
          locate: true
        }, (result: any) => {
          if (result && result.codeResult) {
            console.log('✅ Barcode detected from canvas:', result.codeResult.code, 'Format:', result.codeResult.format);
            resolve({
              success: true,
              barcode: result.codeResult.code,
              format: result.codeResult.format
            });
          } else {
            console.log('❌ No barcode detected in canvas');
            resolve({
              success: false,
              error: 'No barcode detected in image'
            });
          }
        });
      });
      
    } catch (error) {
      console.error('Error detecting barcode from canvas:', error);
      return {
        success: false,
        error: 'Failed to process canvas'
      };
    }
  }

  /**
   * Clean up resources
   */
  static cleanup(): void {
    this.stopCameraDetection();
    this.isInitialized = false;
  }
}
