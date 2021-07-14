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

import React, { useCallback, useState } from "react";
import { Card, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import useAsyncEffect from "use-async-effect";
import { getDNT, toggleDNT } from "@/background/telemetry";

function useDNT(): [boolean, (enabled: boolean) => Promise<void>] {
  const [enabled, setEnabled] = useState<boolean>(true);

  useAsyncEffect(async () => {
    setEnabled(await getDNT());
  }, [setEnabled]);

  const toggle = useCallback(
    async (enabled: boolean) => {
      setEnabled(await toggleDNT(enabled));
    },
    [setEnabled]
  );

  return [enabled, toggle];
}

const PrivacySettings: React.FunctionComponent = () => {
  const [dnt, toggleDNT] = useDNT();

  return (
    <Card>
      <Card.Header>Privacy</Card.Header>
      <Card.Body>
        <Card.Text className="text-info">
          <FontAwesomeIcon icon={faInfoCircle} /> PixieBrix collects{" "}
          <i>anonymous</i> error telemetry and usage metrics to help us improve
          the product.
        </Card.Text>

        <Card.Text>
          We do not collect any browser content or history. The information we
          collect is not linked to your PixieBrix account. See our{" "}
          <a href="https://www.pixiebrix.com/privacy/">Privacy Policy</a> for a
          detailed list of what information we track and why.
        </Card.Text>

        <Form>
          <Form.Group controlId="telemetry">
            <div>
              <Form.Label>
                Anonymous Telemetry: <i>{dnt ? "Disabled" : "Enabled"}</i>
              </Form.Label>
            </div>
            <BootstrapSwitchButton
              size="sm"
              onstyle="info"
              offstyle="light"
              onlabel=" "
              offlabel=" "
              checked={!(dnt ?? false)}
              onChange={async (value) => toggleDNT(!value)}
            />
          </Form.Group>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PrivacySettings;
