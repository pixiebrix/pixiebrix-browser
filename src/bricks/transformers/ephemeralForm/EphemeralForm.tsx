/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import React, { useEffect } from "react";
import validator from "@/validators/formValidator";
import JsonSchemaForm from "@rjsf/bootstrap-4";
import {
  getFormDefinition,
  resolveForm,
  cancelForm,
} from "@/contentScript/messenger/api";
import Loader from "@/components/Loader";
import { getErrorMessage } from "@/errors/errorHelpers";
import { type Target } from "@/types/messengerTypes";
import { validateUUID } from "@/types/helpers";
import ImageCropWidget from "@/components/formBuilder/ImageCropWidget";
import DescriptionField from "@/components/formBuilder/DescriptionField";
import reportError from "@/telemetry/reportError";
import ErrorBoundary from "@/components/ErrorBoundary";
import RjsfSelectWidget from "@/components/formBuilder/RjsfSelectWidget";
import { TOP_LEVEL_FRAME_ID } from "@/domConstants";
import { templates } from "@/components/formBuilder/RjsfTemplates";
import { cloneDeep, isEmpty } from "lodash";
import useAsyncState from "@/hooks/useAsyncState";
import { Stylesheets } from "@/components/Stylesheets";
import EmotionShadowRoot from "react-shadow/emotion";
import bootstrap from "bootstrap/dist/css/bootstrap.min.css?loadAsUrl";
import bootstrapOverrides from "@/pageEditor/sidebar/sidebarBootstrapOverrides.scss?loadAsUrl";

const fields = {
  DescriptionField,
};
const uiWidgets = {
  imageCrop: ImageCropWidget,
  SelectWidget: RjsfSelectWidget,
};

const ModalLayout: React.FC = ({ children }) => (
  // Don't use React Bootstrap's Modal because we want to customize the classes in the layout
  <div className="modal-content">
    <div className="modal-body">{children}</div>
  </div>
);

const PanelLayout: React.FC = ({ children }) => (
  <div className="p-3">{children}</div>
);

/**
 * @see FormTransformer
 */
const EphemeralForm: React.FC = () => {
  const params = new URLSearchParams(location.search);
  const nonce = validateUUID(params.get("nonce"));
  const opener = JSON.parse(params.get("opener")) as Target;
  const mode = params.get("mode") ?? "modal";

  const isModal = mode === "modal";

  // The opener for a sidebar panel will be the sidebar frame, not the host panel frame. The sidebar only opens in the
  // top-level frame, so hard-code the top-level frameId
  const target = isModal
    ? opener
    : { tabId: opener.tabId, frameId: TOP_LEVEL_FRAME_ID };
  const FormContainer = isModal ? ModalLayout : PanelLayout;

  const {
    data: definition,
    isLoading,
    error,
  } = useAsyncState(async () => getFormDefinition(target, nonce), [nonce]);

  // Report error once
  useEffect(() => {
    if (error) {
      // TODO: https://github.com/pixiebrix/pixiebrix-extension/issues/2769
      reportError(error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <FormContainer>
        <Loader />
      </FormContainer>
    );
  }

  if (error) {
    return (
      <FormContainer>
        <div>Form Error</div>

        <div className="text-danger my-3">{getErrorMessage(error)}</div>

        <div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              cancelForm(target, nonce);
            }}
          >
            Close
          </button>
        </div>
      </FormContainer>
    );
  }

  // Custom stylesheets overrides bootstrap themes
  const stylesheetUrls = isEmpty(definition.stylesheets)
    ? [bootstrap, bootstrapOverrides]
    : definition.stylesheets;

  return (
    <FormContainer>
      <ErrorBoundary>
        <EmotionShadowRoot.div>
          <Stylesheets href={stylesheetUrls}>
            <JsonSchemaForm
              // Deep clone the schema because otherwise the schema is not extensible, which
              // breaks validation when @cfworker/json-schema dereferences the schema
              // See https://github.com/cfworker/cfworker/blob/263260ea661b6f8388116db7b8daa859e0d28b25/packages/json-schema/src/dereference.ts#L115
              schema={cloneDeep(definition.schema)}
              uiSchema={definition.uiSchema}
              fields={fields}
              widgets={uiWidgets}
              validator={validator}
              templates={templates}
              onSubmit={({ formData: values }) => {
                void resolveForm(target, nonce, values);
              }}
            >
              <div>
                <button className="btn btn-primary" type="submit">
                  {definition.submitCaption}
                </button>
                {definition.cancelable && isModal && (
                  <button
                    className="btn btn-link"
                    type="button"
                    onClick={() => {
                      cancelForm(target, nonce);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </JsonSchemaForm>
          </Stylesheets>
        </EmotionShadowRoot.div>
      </ErrorBoundary>
    </FormContainer>
  );
};

export default EphemeralForm;
