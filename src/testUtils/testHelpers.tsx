/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { Provider } from "react-redux";
import {
  type Action,
  type AnyAction,
  type CombinedState,
  configureStore,
  type EnhancedStore,
  type PreloadedState,
  type Reducer,
  type ReducersMapObject,
  type ThunkDispatch,
} from "@reduxjs/toolkit";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Form, Formik, type FormikErrors, type FormikValues } from "formik";
import { type Middleware } from "redux";
import { noop } from "lodash";
import { type ThunkMiddlewareFor } from "@reduxjs/toolkit/dist/getDefaultMiddleware";
import { type UnknownObject } from "@/types/objectTypes";
import {
  type Expression,
  type ExpressionType,
  type PipelineExpression,
} from "@/types/runtimeTypes";
import { type BrickPipeline } from "@/bricks/types";
import {
  act as actHook,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type WrapperComponent,
} from "@testing-library/react-hooks";

export const neverPromise = async (...args: unknown[]): Promise<never> => {
  console.error("This method should not have been called", { args });
  throw new Error("This method should not have been called");
};

/**
 * Generate mocked listeners for browser.*.onEvent objects
 * @example browser.permissions.onAdded = getChromeEventMocks();
 */
export const getChromeEventMocks = () => ({
  addListener: jest.fn(),
  removeListener: jest.fn(),
  hasListener: jest.fn(),
  hasListeners: jest.fn(),
});

/**
 * Wait for async handlers, e.g., useAsyncEffect and useAsyncState.
 *
 * NOTE: this assumes you're using "react-dom/test-utils". For hooks you have to use act from
 * "@testing-library/react-hooks"
 */
export const waitForEffect = async () =>
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(async () => {
    // Awaiting the async state update
  });

/**
 * Runs pending jest timers within the "act" wrapper
 */
export const runPendingTimers = async () =>
  act(async () => {
    jest.runOnlyPendingTimers();
  });

// NoInfer is internal type of @reduxjs/toolkit tsHelpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the type copied from @reduxjs/toolkit typings
declare type NoInfer<T> = [T][T extends any ? 0 : never];
type CreateRenderFunctionOptions<TState, TAction extends Action, TProps> = {
  reducer: Reducer<TState, TAction> | ReducersMapObject<TState, TAction>;
  preloadedState?: PreloadedState<CombinedState<NoInfer<TState>>>;

  ComponentUnderTest: React.ComponentType<TProps>;
  defaultProps?: TProps;
};

export type RenderFunctionWithRedux<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the type copied from Redux typings
  S = any,
  // eslint-disable-next-line @typescript-eslint/ban-types -- the type copied from Redux typings
  P = {}
> = (overrides?: {
  propsOverride?: Partial<P>;
  stateOverride?: Partial<S>;
}) => RenderResult;

/**
 * @deprecated Prefer using `createRenderWithWrappers` instead
 */
export function createRenderFunctionWithRedux<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the type copied from Redux typings
  S = any,
  A extends Action = AnyAction,
  // eslint-disable-next-line @typescript-eslint/ban-types -- the type copied from Redux typings
  P = {}
>({
  reducer,
  preloadedState,
  ComponentUnderTest,
  defaultProps,
}: CreateRenderFunctionOptions<S, A, P>): RenderFunctionWithRedux<S, P> {
  return (overrides?: {
    propsOverride?: Partial<P>;
    stateOverride?: Partial<S>;
  }) => {
    const store = configureStore({
      reducer,
      preloadedState: {
        ...preloadedState,
        ...overrides?.stateOverride,
      },
    });

    const props = {
      ...defaultProps,
      ...overrides?.propsOverride,
    };

    return render(
      <Provider store={store}>
        <ComponentUnderTest {...props} />
      </Provider>
    );
  };
}

type SetupRedux = (
  dispatch: ThunkDispatch<unknown, unknown, AnyAction>,
  extra: {
    store: EnhancedStore;
  }
) => void;

type WrapperOptions = RenderOptions & {
  initialValues?: FormikValues;
  initialErrors?: FormikErrors<FormikValues>;
  setupRedux?: SetupRedux;
};

type WrapperResult<
  S = UnknownObject,
  A extends Action = AnyAction,
  M extends ReadonlyArray<Middleware<UnknownObject, S>> = [
    ThunkMiddlewareFor<S>
  ]
> = RenderResult & {
  getReduxStore(): EnhancedStore<S, A, M>;

  /**
   * Get the current form values
   */
  getFormState(): FormikValues;

  /**
   * Update the formik state without interacting with the UI
   * @param newValues the new FormikValues to override the current form state
   * @param shouldValidate whether or not to run validation on the new values
   */
  updateFormState(
    newValues: React.SetStateAction<FormikValues>,
    shouldValidate?: boolean
  ): void;
};

type ConfigureStore<
  S = UnknownObject,
  A extends Action = AnyAction
> = () => EnhancedStore<S, A>;

export function createRenderWithWrappers(configureStore: ConfigureStore) {
  return (
    ui: React.ReactElement,
    {
      initialValues,
      initialErrors,
      setupRedux = noop,
      wrapper,
      ...renderOptions
    }: WrapperOptions = {}
  ): WrapperResult => {
    const store = configureStore();

    setupRedux(store.dispatch, { store });

    let formValues: FormikValues = null;

    let updateFormState: (
      newValues: React.SetStateAction<FormikValues>,
      shouldValidate?: boolean
    ) => void = noop;

    const ExtraWrapper = wrapper ?? (({ children }) => <>{children}</>);

    const Wrapper: React.FC<{ children: React.ReactElement }> = initialValues
      ? ({ children }) => (
          <Provider store={store}>
            <Formik
              initialValues={initialValues}
              initialErrors={initialErrors}
              onSubmit={jest.fn()}
            >
              {({ handleSubmit, values, setValues }) => {
                formValues = values;
                updateFormState = setValues;
                return (
                  <Form onSubmit={handleSubmit}>
                    <ExtraWrapper>{children}</ExtraWrapper>
                    <button type="submit">Submit</button>
                  </Form>
                );
              }}
            </Formik>
          </Provider>
        )
      : ({ children }) => <Provider store={store}>{children}</Provider>;

    const utils = render(ui, { wrapper: Wrapper, ...renderOptions });

    return {
      ...utils,
      getReduxStore() {
        return store;
      },
      getFormState() {
        return formValues;
      },
      updateFormState,
    };
  };
}

type HookWrapperOptions<TProps> = RenderHookOptions<TProps> & {
  /**
   * Initial Formik values.
   */
  initialValues?: FormikValues;
  /**
   * Callback to setup Redux state by dispatching actions.
   */
  setupRedux?: SetupRedux;
};

type HookWrapperResult<
  TProps,
  TResult,
  S = UnknownObject,
  A extends Action = AnyAction,
  M extends ReadonlyArray<Middleware<UnknownObject, S>> = [
    ThunkMiddlewareFor<S>
  ]
> = RenderHookResult<TProps, TResult> & {
  getReduxStore(): EnhancedStore<S, A, M>;

  /**
   * The act function which should be used with the renderHook
   */
  act(callback: () => Promise<void>): Promise<undefined>;

  /**
   * Await all async side effects
   */
  waitForEffect(): Promise<void>;

  /**
   * Get the current form values
   */
  getFormState(): FormikValues;
};

export function createRenderHookWithWrappers(configureStore: ConfigureStore) {
  return <TProps, TResult>(
    hook: (props: TProps) => TResult,
    {
      initialValues,
      setupRedux = noop,
      wrapper,
      ...renderOptions
    }: HookWrapperOptions<TProps> = {}
  ): HookWrapperResult<TProps, TResult> => {
    const store = configureStore();

    setupRedux(store.dispatch, { store });

    let formValues: FormikValues = null;

    const ExtraWrapper: WrapperComponent<TProps> =
      wrapper ?? (({ children }) => <>{children}</>);

    const Wrapper: WrapperComponent<TProps> = initialValues
      ? (props) => (
          <Provider store={store}>
            <Formik initialValues={initialValues} onSubmit={jest.fn()}>
              {({ handleSubmit, values }) => {
                formValues = values;
                return (
                  <Form onSubmit={handleSubmit}>
                    <ExtraWrapper {...props} />
                    <button type="submit">Submit</button>
                  </Form>
                );
              }}
            </Formik>
          </Provider>
        )
      : (props) => (
          <Provider store={store}>
            <ExtraWrapper {...props} />
          </Provider>
        );

    const utils = renderHook(hook, {
      wrapper: Wrapper,
      ...renderOptions,
    });

    return {
      ...utils,
      getReduxStore() {
        return store;
      },
      act: actHook,
      async waitForEffect() {
        await actHook(async () => {
          // Awaiting the async state update
        });
      },
      getFormState() {
        return formValues;
      },
    };
  };
}

export function toExpression<
  TTemplateOrPipeline,
  TTypeTag extends ExpressionType
>(
  type: TTypeTag,
  value: TTemplateOrPipeline
): Expression<TTemplateOrPipeline, TTypeTag> {
  return {
    __type__: type,
    __value__: value,
  };
}

export const EMPTY_PIPELINE: PipelineExpression = Object.freeze(
  toExpression("pipeline", [] as BrickPipeline)
);
