export class UploadError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}

export class FileTooLargeError extends UploadError {
  constructor(public readonly limit: number) {
    super(`File exceeds maximum size of ${limit} bytes`, 413);
    this.name = "FileTooLargeError";
    Object.setPrototypeOf(this, FileTooLargeError.prototype);
  }
}

export class InvalidMimeTypeError extends UploadError {
  constructor(public readonly mime: string, public readonly allowed: string[]) {
    super(`Mime type "${mime}" is not in allowed list: ${allowed.join(", ")}`, 415);
    this.name = "InvalidMimeTypeError";
    Object.setPrototypeOf(this, InvalidMimeTypeError.prototype);
  }
}

export class StorageError extends UploadError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message, 500);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class UploadAbortedError extends UploadError {
  constructor() {
    super("Upload was aborted by the client", 499);
    this.name = "UploadAbortedError";
    Object.setPrototypeOf(this, UploadAbortedError.prototype);
  }
}
