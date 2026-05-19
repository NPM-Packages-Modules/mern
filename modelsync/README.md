# modelsync

Keep Mongoose models, TypeScript types, and validation schemas synchronized automatically.

## Features

- TS type generation
- Zod/Yup sync
- schema diffing
- migration alerts
- auto validation updates

## Example

```ts
import { modelsync } from "@mr-aftab-ahmad-khan/modelsync";

modelsync.sync(UserSchema);
```

## Why

Model duplication creates constant inconsistencies in MERN projects.

## License

MIT
