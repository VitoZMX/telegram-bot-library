export interface ScreenshotResponseType {
  status: 'success' | 'error';
  screenshot: Buffer;
}

export interface ViewportSizeType {
  width: number;
  height: number;
}