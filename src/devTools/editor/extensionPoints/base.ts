/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Metadata, selectMetadata } from "@/core";
import { Framework, FrameworkMeta, KNOWN_READERS } from "@/messaging/constants";
import {
  BaseFormState,
  isCustomReader,
  ReaderFormState,
  ReaderReferenceFormState,
} from "@/devTools/editor/editorSlice";
import psl, { ParsedDomain } from "psl";
import { identity, isPlainObject } from "lodash";
import brickRegistry from "@/blocks/registry";
import { ReaderConfig, ReaderReference } from "@/blocks/readers/factory";
import {
  defaultSelector,
  readerOptions,
} from "@/devTools/editor/tabs/reader/ReaderConfig";
import { ExtensionPointConfig } from "@/extensionPoints/types";
import { find as findBrick } from "@/registry/localRegistry";
import React from "react";

export interface WizardStep {
  step: string;
  Component: React.FunctionComponent<{
    eventKey: string;
    editable?: Set<string>;
    available?: boolean;
  }>;
  extraProps?: object;
}

function getPathFromUrl(url: string): string {
  return url.split("?")[0];
}

function defaultMatchPattern(url: string): string {
  const cleanURL = getPathFromUrl(url);
  console.debug(`Clean URL: ${cleanURL}`);
  const obj = new URL(cleanURL);
  for (const [name] of (obj.searchParams as any).entries()) {
    console.debug(`Deleting param ${name}`);
    obj.searchParams.delete(name);
  }
  obj.pathname = "*";
  obj.hash = "";
  console.debug(`Generate match pattern`, { href: obj.href });
  return obj.href;
}

function defaultReader(frameworks: FrameworkMeta[]): Framework {
  const knownFrameworks = frameworks.filter((x) =>
    KNOWN_READERS.includes(x.id)
  );
  return knownFrameworks.length ? knownFrameworks[0].id : "jquery";
}

export function makeIsAvailable(
  url: string
): { matchPatterns: string; selectors: string | null } {
  return {
    matchPatterns: defaultMatchPattern(url),
    selectors: null,
  };
}

export function makeReaderId(
  foundationId: string,
  excludeIds: string[] = []
): string {
  const base = `${foundationId}-reader`;
  if (!excludeIds.includes(base)) {
    return base;
  }
  let num = 1;
  let id: string;
  do {
    num++;
    id = `${base}-${num}`;
  } while (excludeIds.includes(id));
  return id;
}

interface ReaderOptions {
  defaultSelector?: string;
  reservedIds?: string[];
  name?: string;
}

export function makeDefaultReader(
  metadata: Metadata,
  frameworks: FrameworkMeta[],
  { defaultSelector, reservedIds, name }: ReaderOptions = {
    defaultSelector: undefined,
    reservedIds: [],
  }
): ReaderFormState {
  return {
    metadata: {
      id: makeReaderId(metadata.id, reservedIds),
      name: name ?? `Default reader for ${metadata.id}`,
    },
    outputSchema: {},
    definition: {
      type: defaultReader(frameworks),
      selector: defaultSelector,
      optional: false,
      selectors: {},
    },
  };
}

export function makeBaseState(
  uuid: string,
  defaultSelector: string | null,
  metadata: Metadata,
  frameworks: FrameworkMeta[]
): Omit<BaseFormState, "type" | "label"> {
  return {
    uuid,
    services: [],
    readers: [makeDefaultReader(metadata, frameworks, { defaultSelector })],
    extension: {},
    extensionPoint: {},
  };
}

export function getDomain(url: string): string {
  const urlClass = new URL(url);
  const { domain } = psl.parse(urlClass.host.split(":")[0]) as ParsedDomain;
  return domain;
}

export async function generateExtensionPointMetadata(
  label: string,
  scope: string,
  url: string,
  reservedNames: string[]
): Promise<Metadata> {
  const domain = getDomain(url);

  await brickRegistry.fetch();

  const allowId = async (id: string) => {
    if (!reservedNames.includes(id)) {
      try {
        await brickRegistry.lookup(id);
      } catch (err) {
        // name doesn't exist yet
        return true;
      }
    }
    return false;
  };

  for (let index = 1; index < 1000; index++) {
    const id =
      index === 1
        ? `${scope ?? "@local"}/${domain}/foundation`
        : `${scope ?? "@local"}/${domain}/foundation-${index}`;

    const ok = (
      await Promise.all([allowId(id), allowId(makeReaderId(id))])
    ).every(identity);

    if (ok) {
      return {
        id,
        name: `${domain} ${label}`,
      };
    }
  }
  throw new Error("Could not find available id");
}

export function makeExtensionReaders({
  readers,
}: BaseFormState): (ReaderConfig | ReaderReference)[] {
  return readers.map((reader) => {
    if (!isCustomReader(reader)) {
      return { metadata: reader.metadata };
    }

    const { metadata, definition, outputSchema = {} } = reader;

    const readerOption = readerOptions.find((x) => x.value === definition.type);

    return {
      apiVersion: "v1",
      kind: "reader",
      metadata: {
        id: metadata.id,
        name: metadata.name,
        version: "1.0.0",
        description: "Reader created with the Page Editor",
      },
      definition: {
        reader: (readerOption?.makeConfig ?? defaultSelector)(definition),
      },
      outputSchema,
    };
  });
}

export async function makeReaderFormState(
  extensionPoint: ExtensionPointConfig
): Promise<(ReaderFormState | ReaderReferenceFormState)[]> {
  const readerId = extensionPoint.definition.reader;

  let readerIds: string[];

  if (isPlainObject(readerId)) {
    throw new Error("Key-based composite readers not supported");
  } else if (typeof readerId === "string") {
    readerIds = [readerId];
  } else if (Array.isArray(readerId)) {
    readerIds = readerId as string[];
  } else {
    throw new Error("Unexpected reader configuration");
  }

  return Promise.all(
    readerIds.map(async (readerId) => {
      const brick = await findBrick(readerId);

      if (!brick) {
        try {
          const reader = await brickRegistry.lookup(readerId);
          return { metadata: selectMetadata(reader) };
        } catch (err) {
          console.error("Cannot find reader", { readerId, err });
          throw new Error("Cannot find reader");
        }
      }

      const reader = (brick.config as unknown) as ReaderConfig;
      return {
        metadata: reader.metadata,
        outputSchema: reader.outputSchema,
        definition: reader.definition.reader as any,
      };
    })
  );
}
