import { useDispatch } from "react-redux";
import { useAsyncEffect } from "use-async-effect";
import { internalStarterBrickMetaFactory } from "@/pageEditor/starterBricks/base";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { getExampleBrickPipeline } from "@/pageEditor/exampleStarterBrickConfigs";
import { actions } from "@/pageEditor/slices/editorSlice";
import { updateDynamicElement } from "@/contentScript/messenger/api";
import { openSidePanel } from "@/utils/sidePanelUtils";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import { ADAPTERS } from "@/pageEditor/starterBricks/adapter";
import notify from "@/utils/notify";
import {
  allFramesInInspectedTab,
  getCurrentInspectedURL,
  inspectedTab,
} from "@/pageEditor/context/connection";

const { addElement, toggleInsert } = actions;

function useAutoInsert(type: StarterBrickType): void {
  const dispatch = useDispatch();

  useAsyncEffect(async () => {
    // These have their own UI, so don't auto-insert
    if (type === "menuItem" || type === "panel" || type == null) {
      return;
    }

    try {
      const url = await getCurrentInspectedURL();

      const config = ADAPTERS.get(type);

      const metadata = internalStarterBrickMetaFactory();

      const formState = config.fromNativeElement(
        url,
        metadata,
        // eslint-disable-next-line unicorn/no-useless-undefined -- typescript expects the argument
        undefined,
      ) as ModComponentFormState;

      formState.extension.blockPipeline = getExampleBrickPipeline(
        formState.type,
      );

      dispatch(addElement(formState));
      dispatch(actions.checkActiveElementAvailability());

      // Don't auto-run tours on selection in Page Editor
      if (config.elementType !== "tour") {
        updateDynamicElement(
          allFramesInInspectedTab,
          config.asDynamicElement(formState),
          "useAutoInsert",
        );
      }

      // TODO: report if created new, or using existing foundation
      reportEvent(Events.PAGE_EDITOR_START, {
        type: config.elementType,
      });

      if (config.elementType === "actionPanel") {
        // For convenience, open the side panel if it's not already open so that the user doesn't
        // have to manually toggle it
        void openSidePanel(inspectedTab.tabId);
      }

      reportEvent(Events.MOD_COMPONENT_ADD_NEW, {
        type: config.elementType,
      });
    } catch (error) {
      notify.error({
        message: "Error adding mod",
        error,
      });
      dispatch(toggleInsert(null));
    }
  }, [type, dispatch]);
}

export default useAutoInsert;
