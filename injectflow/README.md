# injectflow

**Topics:** `container` · `di` · `express` · `injectflow` · `ioc` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `typescript`

**Smart dependency injection** for Node/Express-sized apps — **register** factories by string token, **resolve** dependencies, optional **singleton** scope, and **reset** in tests without pulling in a full DI framework.

## Install

```bash
npm install @mr-aftab-ahmad-khan/injectflow
```

## Example

```typescript
import { injectflow } from "@mr-aftab-ahmad-khan/injectflow";

class UserRepo {}
class UserService {
  constructor(private repo: UserRepo) {}
}

const container = injectflow();

container.register("UserRepo", () => new UserRepo());
container.register("UserService", () => {
  return new UserService(container.resolve<UserRepo>("UserRepo"));
});

const svc = container.resolve<UserService>("UserService");
```

## License

MIT
