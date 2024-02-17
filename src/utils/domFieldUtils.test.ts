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

import { setFieldValue } from "./domFieldUtils";

function createCheckableInput(type: string, checked?: boolean, value?: string) {
  const input = document.createElement("input");
  input.setAttribute("type", type);
  input.setAttribute("value", value);
  input.checked = Boolean(checked);
  return input;
}

describe("setFieldValue", () => {
  it("sets the value of an input", async () => {
    const input = document.createElement("input");
    input.setAttribute("name", "test");
    await setFieldValue(input, "✅");
    expect(input.value).toBe("✅");
  });

  it("sets the value of a textarea", async () => {
    const textarea = document.createElement("textarea");
    textarea.setAttribute("name", "test");
    await setFieldValue(textarea, "✅");
    expect(textarea.value).toBe("✅");
  });

  it("sets the value of a select", async () => {
    const select = document.createElement("select");
    select.setAttribute("name", "test");
    const option = document.createElement("option");
    option.setAttribute("value", "✅");
    select.append(option);
    await setFieldValue(select, "✅");
    expect(select.value).toBe("✅");
  });

  it("checks checkbox", async () => {
    const checkbox = createCheckableInput("checkbox");
    await setFieldValue(checkbox, true);
    expect(checkbox.checked).toBe(true);
  });

  it("checks radio button", async () => {
    const radio = createCheckableInput("radio");
    await setFieldValue(radio, true);
    expect(radio.checked).toBe(true);
  });

  it("checks a group of checkboxes by value", async () => {
    const checkbox1 = createCheckableInput("checkbox", false, "✅");
    const checkbox2 = createCheckableInput("checkbox", false, "🌞");

    await setFieldValue(checkbox1, "✅", { isOption: true });
    expect(checkbox1.value).toBe("✅");
    expect(checkbox1.checked).toBe(true);

    await setFieldValue(checkbox2, "✅", { isOption: true }); // No-op
    expect(checkbox2.value).toBe("🌞"); // It should not alter the original value
    expect(checkbox2.checked).toBe(false); // It should only be checked if the value matches
  });

  it("checks a group of radio buttons by value", async () => {
    const radio1 = createCheckableInput("radio", false, "✅");
    const radio2 = createCheckableInput("radio", false, "🌞");

    await setFieldValue(radio1, "✅", { isOption: true });
    expect(radio1.value).toBe("✅");
    expect(radio1.checked).toBe(true);

    await setFieldValue(radio2, "✅", { isOption: true }); // No-op
    expect(radio2.value).toBe("🌞"); // It should not alter the original value
    expect(radio2.checked).toBe(false); // It should only be checked if the value matches
  });
});
