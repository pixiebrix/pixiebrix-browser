import CollapsibleFieldSection from "@/pageEditor/fields/CollapsibleFieldSection";
import { useDispatch, useSelector } from "react-redux";
import { selectActiveNodeUIState } from "@/pageEditor/slices/editorSelectors";
import { actions } from "@/pageEditor/slices/editorSlice";
import React from "react";

const ConnectedCollapsibleFieldSection = ({
  title,
  ...rest
}: {
  children: React.ReactNode;
  title: string;
  bodyRef?: React.MutableRefObject<HTMLDivElement>;
}) => {
  const dispatch = useDispatch();
  const UIState = useSelector(selectActiveNodeUIState);
  // Allow to fail gracefully using nullish coalescing operator
  const isExpanded = UIState?.expandedFieldSections?.[title] ?? true;

  return (
    <CollapsibleFieldSection
      title={title}
      toggleExpanded={() => {
        dispatch(
          actions.setExpandedFieldSections({
            id: title,
            isExpanded: !isExpanded,
          })
        );
      }}
      expanded={isExpanded}
      {...rest}
    />
  );
};

export default ConnectedCollapsibleFieldSection;
