export class PromptNotFoundError extends Error {
  constructor(public readonly promptName: string, public readonly version?: number) {
    super(
      version !== undefined
        ? `Prompt "${promptName}" version ${version} not found`
        : `Prompt "${promptName}" not found`,
    );
    this.name = "PromptNotFoundError";
    Object.setPrototypeOf(this, PromptNotFoundError.prototype);
  }
}

export class VersionConflictError extends Error {
  constructor(public readonly promptName: string, public readonly version: number) {
    super(`Prompt "${promptName}" already has version ${version}`);
    this.name = "VersionConflictError";
    Object.setPrototypeOf(this, VersionConflictError.prototype);
  }
}

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}
