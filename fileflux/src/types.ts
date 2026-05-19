import type { Readable } from "node:stream";

export interface UploadedFile {
  fieldName: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url?: string;
  metadata: Record<string, string>;
}

export interface UploadLimits {
  fileSize?: number;
  files?: number;
  allowedMimeTypes?: string[];
}

export interface UploadHooks {
  onUploadStart?: (info: { filename: string; mimeType: string }, req: unknown) => Promise<void> | void;
  onUploadComplete?: (file: UploadedFile, req: unknown) => Promise<void> | void;
}

export interface ProgressEvent {
  filename: string;
  bytesReceived: number;
  bytesTotal: number | null;
  percent: number | null;
}

export interface PresignResult {
  url: string;
  fields: Record<string, string>;
  storageKey: string;
  expiresAt: string;
}

export interface PresignOptions {
  filename: string;
  contentType: string;
  maxSizeBytes?: number;
  expiresInSeconds?: number;
}

export interface StorageAdapter {
  upload(input: {
    stream: Readable;
    filename: string;
    mimeType: string;
    /** Number of bytes if known (Content-Length). */
    size?: number;
  }): Promise<{ key: string; url?: string; size: number }>;
  presign?(opts: PresignOptions): Promise<PresignResult>;
}

export interface UpflowOptions {
  storage: StorageAdapter;
  limits?: UploadLimits;
  hooks?: UploadHooks;
}
