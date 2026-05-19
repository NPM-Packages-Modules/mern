export class ImagoError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ImagoError";
    this.status = status;
    Object.setPrototypeOf(this, ImagoError.prototype);
  }
}

export class DimensionLimitError extends ImagoError {
  constructor(public readonly requested: number, public readonly max: number) {
    super(`Requested dimension ${requested} exceeds maximum ${max}`, 413);
    this.name = "DimensionLimitError";
    Object.setPrototypeOf(this, DimensionLimitError.prototype);
  }
}

export class UnsupportedFormatError extends ImagoError {
  constructor(public readonly format: string) {
    super(`Unsupported image format: ${format}`, 400);
    this.name = "UnsupportedFormatError";
    Object.setPrototypeOf(this, UnsupportedFormatError.prototype);
  }
}

export class SourceNotFoundError extends ImagoError {
  constructor(public readonly key: string) {
    super(`Source image not found: ${key}`, 404);
    this.name = "SourceNotFoundError";
    Object.setPrototypeOf(this, SourceNotFoundError.prototype);
  }
}
