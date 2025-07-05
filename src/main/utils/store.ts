import Store from 'electron-store';

// Wrapper to ensure type compatibility with legacy code
export class ElectronStore<T extends Record<string, any> = Record<string, any>> {
  private store: any;

  constructor(options?: any) {
    this.store = new Store(options);
  }

  // Add compatibility methods for legacy code
  get(key: string, defaultValue?: any): any {
    return this.store.get(key, defaultValue);
  }

  set(key: string, value: any): void {
    this.store.set(key, value);
  }
}

export default ElectronStore;