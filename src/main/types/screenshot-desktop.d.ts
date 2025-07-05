declare module 'screenshot-desktop' {
  interface ScreenshotOptions {
    filename?: string;
    format?: 'png' | 'jpg';
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  export = screenshot;
}