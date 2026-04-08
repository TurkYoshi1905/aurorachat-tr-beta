declare global {
  interface Window {
    electronAPI?: {
      showOpenDialog: (options: ElectronOpenDialogOptions) => Promise<ElectronOpenDialogResult>;
      showSaveDialog: (options: ElectronSaveDialogOptions) => Promise<ElectronSaveDialogResult>;
      readFiles: (filePaths: string[]) => Promise<ElectronFileData[]>;
      writeFile: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

interface ElectronOpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: string[];
}

interface ElectronOpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface ElectronSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

interface ElectronFileData {
  name: string;
  type: string;
  size: number;
  base64: string;
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI;
};

const base64ToFile = (data: ElectronFileData): File => {
  const bytes = atob(data.base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new File([buf], data.name, { type: data.type });
};

export const pickFiles = async (options: {
  accept?: string;
  multiple?: boolean;
}): Promise<File[]> => {
  if (isElectron() && window.electronAPI) {
    const filters: { name: string; extensions: string[] }[] = [];
    if (options.accept && options.accept !== '*') {
      const exts = options.accept
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('.'))
        .map((s) => s.slice(1));
      if (exts.length > 0) {
        filters.push({ name: 'Dosyalar', extensions: exts });
      }
    }
    if (filters.length === 0) {
      filters.push({ name: 'Tüm Dosyalar', extensions: ['*'] });
    }

    const result = await window.electronAPI.showOpenDialog({
      title: 'Dosya Seç',
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const fileData = await window.electronAPI.readFiles(result.filePaths);
    return fileData.map(base64ToFile);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) input.accept = options.accept;
    if (options.multiple) input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.oncancel = () => resolve([]);
    input.click();
  });
};

export const saveFileFromUrl = async (url: string, defaultFilename: string): Promise<void> => {
  if (isElectron() && window.electronAPI) {
    const ext = defaultFilename.split('.').pop() || '';
    const filters = ext ? [{ name: 'Dosya', extensions: [ext] }] : [{ name: 'Tüm Dosyalar', extensions: ['*'] }];

    const result = await window.electronAPI.showSaveDialog({
      title: 'Dosyayı Kaydet',
      defaultPath: defaultFilename,
      filters,
    });

    if (result.canceled || !result.filePath) return;

    try {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      await window.electronAPI.writeFile(result.filePath, base64);
    } catch {
    }
    return;
  }

  window.open(url, '_blank');
};
