type FileTypeResult = {
  ext: string;
  mime: string;
} | undefined;

type FileTypeModule = {
  fromBuffer?: (input: Buffer) => Promise<FileTypeResult>;
  fileTypeFromBuffer?: (input: Buffer) => Promise<FileTypeResult>;
  default?: {
    fromBuffer?: (input: Buffer) => Promise<FileTypeResult>;
    fileTypeFromBuffer?: (input: Buffer) => Promise<FileTypeResult>;
  };
};

let fileTypeModulePromise: Promise<FileTypeModule> | null = null;

async function loadFileTypeModule(): Promise<FileTypeModule> {
  if (!fileTypeModulePromise) {
    fileTypeModulePromise = import('file-type') as Promise<FileTypeModule>;
  }
  return fileTypeModulePromise;
}

export async function detectFileTypeFromBuffer(
  input: Buffer
): Promise<FileTypeResult> {
  const fileTypeModule = await loadFileTypeModule();
  const detector =
    fileTypeModule.fileTypeFromBuffer ||
    fileTypeModule.fromBuffer ||
    fileTypeModule.default?.fileTypeFromBuffer ||
    fileTypeModule.default?.fromBuffer;

  if (typeof detector !== 'function') {
    throw new TypeError('No file-type buffer detector is available.');
  }

  return detector(input);
}
