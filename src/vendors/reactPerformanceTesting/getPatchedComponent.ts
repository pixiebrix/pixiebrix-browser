import { PerfTools, PerfState } from "./perfTypes";
import { getDisplayName } from "./getDisplayName";
import { isClassComponent } from "./utils/isClassComponent";
import { isMemoComponent } from "./utils/isMemoComponent";
import { ReactSymbol } from "./utils/symbols";
import { isForwardRefComponent } from "./utils/isForwardRefComponent";
import { isFunctionComponent } from "./utils/isFunctionComponent";
import { pushTask } from "./utils/pushTask";

const setArray = (
  displayName: string,
  state: PerfTools["renderCount"] | PerfTools["renderTime"],
  initialValue: any
) => {
  const obj = state.current[displayName];
  let currentIndex = -1;
  if (obj) {
    state.current[displayName] = Array.isArray(obj)
      ? [...obj, initialValue]
      : [{ ...obj }, initialValue];

    currentIndex = Array.isArray(obj) ? obj.length : 1;
  }

  return currentIndex;
};

const updateRenderCount = (
  renderCount: PerfTools["renderCount"],
  index: number,
  displayName: string
) => {
  if (!displayName) {
    return;
  }

  const obj = renderCount.current;
  if (!obj[displayName]) {
    obj[displayName] = { value: 0 };
  }

  pushTask(() => {
    const obj = renderCount.current;
    const field = obj[displayName];

    if (Array.isArray(field)) {
      const formattedIndex = index === -1 ? 0 : index;
      field[formattedIndex].value += 1;
      return;
    }

    field!.value += 1;
  });
};

const startMeasureRenderTime = (
  renderTime: PerfTools["renderTime"],
  index: number,
  displayName?: string
) => {
  if (!displayName) {
    return () => {};
  }

  const obj = renderTime.current;
  if (!obj[displayName]) {
    obj[displayName] = { mount: null as any, updates: [] };
  }

  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;

    pushTask(() => {
      const obj = renderTime.current;
      const field = obj[displayName]!;
      if (Array.isArray(field)) {
        const formattedIndex = index === -1 ? 0 : index;
        const fieldValues = field[formattedIndex];
        field[formattedIndex] = {
          mount: fieldValues.mount || duration,
          updates: fieldValues.mount ? [...fieldValues.updates, duration] : [],
        };
        return;
      }

      obj[displayName] = {
        mount: field.mount || duration,
        updates: field.mount ? [...field.updates, duration] : [],
      };
    });
  };
};

export interface PatchedClassComponent {}

const createClassComponent = (
  type: React.ComponentClass,
  { renderCount, renderTime }: PerfTools,
  { hasRenderCount, hasRenderTime }: PerfState
) => {
  const ClassComponent = type as new (...args: any) => any;
  const displayName = getDisplayName(type);
  if (!displayName) {
    console.warn(
      "[react-performance-testing] You have anonymous component. If your component don't have display name, we can not set property to renderCount.current"
    );
  }

  class _PatchedClassComponent
    extends ClassComponent
    implements PatchedClassComponent
  {
    constructor(props: any, context: any) {
      super(props, context);

      const origRender = super.render || this.render;

      if (hasRenderTime) {
        this.currentIndex = setArray(displayName, renderTime, {
          mount: null,
          updates: [],
        });
      }

      if (hasRenderCount) {
        this.currentIndex = setArray(displayName, renderCount, { value: 0 });
      }

      // This probably means render is an arrow function or this.render.bind(this) was called on the original class
      // https://github.com/welldone-software/why-did-you-render/blob/master/src/patches/patchClassComponent.js#L16
      const IsBoundFunction = origRender !== ClassComponent.prototype.render;
      if (IsBoundFunction) {
        this.render = () => {
          _PatchedClassComponent.prototype.render.apply(this);
          return origRender();
        };
      }
    }

    componentDidMount() {
      if (this.endMeasureRenderTime) {
        this.endMeasureRenderTime();
      }
    }

    componentDidUpdate() {
      if (this.endMeasureRenderTime) {
        this.endMeasureRenderTime();
      }
    }

    render() {
      if (hasRenderCount) {
        updateRenderCount(renderCount, this.currentIndex, displayName);
      }

      if (hasRenderTime) {
        this.endMeasureRenderTime = startMeasureRenderTime(
          renderTime,
          this.currentIndex,
          displayName
        );
      }

      return super.render ? super.render() : null;
    }
  }

  return _PatchedClassComponent;
};

const createFunctionComponent = (
  type: React.FunctionComponent,
  { renderCount, renderTime }: PerfTools,
  { hasRenderCount, hasRenderTime }: PerfState,
  React: any
) => {
  const functionComponent = type as (...args: any[]) => React.ReactElement;
  const displayName = getDisplayName(type);
  if (!displayName) {
    console.warn(
      "[react-performance-testing] You have anonymous component. If your component don't have display name, we can not set property to renderCount.current"
    );
  }

  const PatchedFunctionComponent: React.FC = (...args: any) => {
    const currentIndex = React.useMemo(() => {
      let index = -1;

      if (hasRenderTime) {
        index = setArray(displayName, renderTime, { mount: null, updates: [] });
      }

      if (hasRenderCount) {
        index = setArray(displayName, renderCount, { value: 0 });
      }

      return index;
    }, []);
    const endMeasureRenderTime = React.useRef(null);

    if (hasRenderCount) {
      updateRenderCount(renderCount, currentIndex, displayName);
    }

    React.useLayoutEffect(() => {
      if (endMeasureRenderTime.current) {
        endMeasureRenderTime.current();
      }
    });

    if (hasRenderTime) {
      endMeasureRenderTime.current = startMeasureRenderTime(
        renderTime,
        currentIndex,
        displayName
      );
    }

    return functionComponent(...args);
  };

  return PatchedFunctionComponent;
};

const createMemoComponent = (
  type: React.MemoExoticComponent<any> & {
    compare: (state: any, props: any) => boolean;
  },
  tools: PerfTools,
  perfState: PerfState,
  React: any
): any => {
  const { type: InnerMemoComponent, compare } = type;

  const isInnerForwardRefComponent = isForwardRefComponent(InnerMemoComponent);

  const WrappedFunctionalComponent = isInnerForwardRefComponent
    ? InnerMemoComponent.render
    : InnerMemoComponent;

  const PatchedInnerComponent = isClassComponent(InnerMemoComponent)
    ? createClassComponent(WrappedFunctionalComponent, tools, perfState)
    : isMemoComponent(InnerMemoComponent)
    ? createMemoComponent(WrappedFunctionalComponent, tools, perfState, React)
    : createFunctionComponent(
        WrappedFunctionalComponent,
        tools,
        perfState,
        React
      );

  try {
    PatchedInnerComponent.displayName = getDisplayName(
      WrappedFunctionalComponent
    );
  } catch {}

  const PatchedMemoComponent = React.memo(
    isInnerForwardRefComponent
      ? React.forwardRef(PatchedInnerComponent)
      : PatchedInnerComponent,
    compare
  );

  return PatchedMemoComponent;
};

const createForwardRefComponent = (
  type: React.ForwardRefExoticComponent<any> & {
    render: React.ForwardRefRenderFunction<any>;
  },
  tools: PerfTools,
  perfState: PerfState,
  React: any
): any => {
  const { render: InnerForwardRefComponent } = type;

  const isInnerMemoComponent = isMemoComponent(InnerForwardRefComponent as any);

  const WrappedFunctionalComponent = isInnerMemoComponent
    ? (InnerForwardRefComponent as any).type
    : InnerForwardRefComponent;

  const PatchedInnerComponent = createFunctionComponent(
    WrappedFunctionalComponent,
    tools,
    perfState,
    React
  );

  try {
    PatchedInnerComponent.displayName = getDisplayName(
      WrappedFunctionalComponent
    );
  } catch {}

  const PatchedForwardRefComponent = React.forwardRef(
    isInnerMemoComponent
      ? React.memo(PatchedInnerComponent, WrappedFunctionalComponent.compare)
      : PatchedInnerComponent
  );

  return PatchedForwardRefComponent;
};

const createPatchedComponent = (
  type: React.ElementType<React.ComponentClass | React.FunctionComponent> & {
    $$typeof: ReactSymbol;
  },
  tools: PerfTools,
  perfState: PerfState,
  React: any
): any => {
  if (isMemoComponent(type)) {
    return createMemoComponent(type, tools, perfState, React);
  }

  if (isForwardRefComponent(type)) {
    return createForwardRefComponent(type, tools, perfState, React);
  }

  if (isClassComponent(type)) {
    return createClassComponent(type, tools, perfState);
  }

  // Here is only checking type
  /* istanbul ignore else */
  if (isFunctionComponent(type)) {
    return createFunctionComponent(type, tools, perfState, React);
  }
};

export const getPatchedComponent = (
  componentsMap: WeakMap<any, any>,
  type: React.ElementType<React.ComponentClass | React.FunctionComponent> & {
    $$typeof: ReactSymbol;
  },
  tools: PerfTools,
  perfState: PerfState,
  React: any
) => {
  const PatchedComponent = createPatchedComponent(
    type,
    tools,
    perfState,
    React
  );

  try {
    PatchedComponent.displayName = getDisplayName(type);
  } catch {}

  componentsMap.set(type, PatchedComponent);

  return PatchedComponent;
};
