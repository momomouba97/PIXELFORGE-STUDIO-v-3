export {};

declare global {
  interface Window {
    pf?: {
      platform: string;
      openImages: () => Promise<{ name: string; data: Uint8Array }[]>;
      saveFile: (opts: { suggestedName: string; ext: string; data: Uint8Array }) => Promise<{ saved: boolean; path?: string }>;
      openProject: () => Promise<string | null>;
    };
  }
}
