/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

const varRegex = /(?<varName>@\w+(\.|\w|(\[\d+])|(\[("|')[\s\w]+("|')]))*)/g;

// This method is based on regex because we want to show popup even for incomplete template, ex. "{{ @foo."
function getLikelyVariableAtPosition(
  template: string,
  position: number
): string | null {
  let match = varRegex.exec(template);
  while (match !== null) {
    const { varName } = match.groups;
    const startIndex = match.index;
    if (startIndex <= position && position <= startIndex + varName.length) {
      varRegex.lastIndex = 0;
      return varName;
    }

    match = varRegex.exec(template);
  }

  return null;
}

export default getLikelyVariableAtPosition;
