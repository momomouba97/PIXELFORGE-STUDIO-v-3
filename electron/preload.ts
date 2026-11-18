import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pf', {
  platform: process.platform,
  openImages: (): Promise<{ name: string; data: Uint8Array }[]> => ipcRenderer.invoke('file:openImages'),
  saveFile: (opts: { suggestedName: string; ext: string; data: Uint8Array }): Promise<{ saved: boolean; path?: string }> =>
    ipcRenderer.invoke('file:save', opts),
  openProject: (): Promise<string | null> => ipcRenderer.invoke('file:openProject'),
});
