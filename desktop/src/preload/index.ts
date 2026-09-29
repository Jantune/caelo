import { contextBridge, ipcRenderer } from 'electron'
import type { CoreConnection } from '../main/index'

// Bezpieczny most: renderer dostaje wyłącznie te metody (contextIsolation).
const caeloApi = {
  /** Bieżący stan połączenia z backendem (port, token, baseUrl). */
  getCore: (): Promise<CoreConnection> => ipcRenderer.invoke('core:get'),

  /** Subskrypcja zmian stanu połączenia. Zwraca funkcję wypisującą. */
  onCoreStatus: (callback: (status: CoreConnection) => void): (() => void) => {
    const listener = (_event: unknown, status: CoreConnection): void => callback(status)
    ipcRenderer.on('core:status', listener)
    return () => ipcRenderer.removeListener('core:status', listener)
  },

  /** Natywny wybór folderu (zwraca ścieżkę lub null po anulowaniu). */
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),

  /** Otwiera plik/folder w domyślnej aplikacji systemu. */
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:openPath', path),

  /** Kopiuje tekst do schowka systemowego przez natywny proces główny. */
  writeClipboard: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:writeText', text),

  /** Ustawia motyw w procesie głównym (aktualizuje natywny pasek tytułu Windows/macOS). */
  setTheme: (mode: 'light' | 'dark' | 'system'): Promise<boolean> =>
    ipcRenderer.invoke('theme:set', mode),

  /** Pobiera bieżący motyw z procesu głównego. */
  getTheme: (): Promise<'light' | 'dark' | 'system'> =>
    ipcRenderer.invoke('theme:get')
}

contextBridge.exposeInMainWorld('caelo', caeloApi)

export type CaeloApi = typeof caeloApi
