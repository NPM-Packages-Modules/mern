# renderguard

**Topics:** `mern` · `mern-packages` · `merndev` · `nodejs` · `npm-pm` · `observability` · `performance` · `profiler` · `re-render` · `react` · `renderguard` · `typescript`

Wrap subtrees with React **`Profiler`**, stream structured **`onRender`** metrics, optionally **warn** on slow commits, and compute a tiny **render score** from samples.

```tsx
import { renderguard } from "@mr-aftab-ahmad-khan/renderguard";

const Profiled = renderguard("Dashboard", { warnMs: 8 });

export function Dashboard(props) {
  return (
    <Profiled>
      <RealDashboard {...props} />
    </Profiled>
  );
}
```

## License

MIT
