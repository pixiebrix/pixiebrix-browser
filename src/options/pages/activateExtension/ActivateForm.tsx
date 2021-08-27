/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import React, { useCallback, useMemo } from "react";
import { AuthOption } from "@/auth/authTypes";
import { CloudExtension } from "@/types/contract";
import { Form, Formik, FormikProps } from "formik";
import { useDispatch } from "react-redux";
import { push } from "connected-react-router";
import { optionsSlice } from "@/options/slices";
import useNotifications from "@/hooks/useNotifications";
import ServicesCard from "@/options/pages/activateExtension/ServicesCard";
import { FormState } from "@/options/pages/activateExtension/activateTypes";
import ActivateCard from "@/options/pages/activateExtension/ActivateCard";

const { actions } = optionsSlice;

const ActivateForm: React.FunctionComponent<{
  extension: CloudExtension;
  authOptions: AuthOption[];
}> = ({ extension, authOptions }) => {
  const notify = useNotifications();
  const dispatch = useDispatch();

  const initialValues: FormState = useMemo(() => {
    const uuids = new Set<string>(authOptions.map((x) => x.value));
    return {
      services: extension.services.map((service) => ({
        ...service,
        config: uuids.has(service.config) ? service.config : null,
      })),
    };
  }, [authOptions, extension]);

  const onSubmit = useCallback(
    async (values: FormState, helpers: FormikProps<FormState>) => {
      try {
        dispatch(
          actions.installCloudExtension({
            extension: { ...extension, ...values },
          })
        );
        notify.success("Activated brick");
        dispatch(push("/installed"));
      } catch (error: unknown) {
        notify.error("Error activating brick", {
          error,
        });
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [notify, extension, dispatch]
  );

  return (
    <Formik initialValues={initialValues} onSubmit={onSubmit}>
      {() => (
        <Form id="activate-wizard" noValidate>
          <ServicesCard authOptions={authOptions} />
          <ActivateCard extension={extension} />
        </Form>
      )}
    </Formik>
  );
};

export default ActivateForm;
