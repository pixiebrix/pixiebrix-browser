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

import React, { useState } from "react";
import { getBaseURL } from "@/data/service/baseService";
import { useAsyncEffect } from "use-async-effect";
import { isLinked } from "@/auth/authStorage";
import { Card } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import useAsyncState from "@/hooks/useAsyncState";

const ConnectExtensionCard: React.FunctionComponent = () => {
  const [hasExtensionKey, setHasExtensionKey] = useState(true);
  const { data: serviceURL } = useAsyncState(getBaseURL, []);

  useAsyncEffect(
    async (isMounted) => {
      const hasKey = await isLinked();
      if (isMounted()) return;
      setHasExtensionKey(hasKey);
    },
    [setHasExtensionKey],
  );

  if (hasExtensionKey) {
    return null;
  }

  return (
    <Card className="mb-4">
      <Card.Header>Connect to PixieBrix</Card.Header>
      <Card.Body>
        <p>
          By linking your browser extension with PixieBrix, you&apos;ll get
          access to team features and public services.
        </p>
        {serviceURL && (
          <a
            href={new URL("extension", serviceURL).href}
            className="btn btn-primary"
            rel="noreferrer"
            target="_blank"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} /> Open PixieBrix Website
          </a>
        )}
      </Card.Body>
    </Card>
  );
};

export default ConnectExtensionCard;
