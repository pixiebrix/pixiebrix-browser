import { ReactSymbol, REACT_FORWARD_REF_TYPE } from "./symbols";

export const isForwardRefComponent = (
  Component: React.ElementType<
    React.ComponentClass | React.FunctionComponent
  > & { $$typeof: ReactSymbol }
): Component is React.ForwardRefExoticComponent<any> & {
  render: React.ForwardRefRenderFunction<any>;
} => Component.$$typeof === REACT_FORWARD_REF_TYPE;
