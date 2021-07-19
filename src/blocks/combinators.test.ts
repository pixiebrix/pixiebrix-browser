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

test("dummy test", async () => {
  console.warn("combinator tests are disabled");
});

// Import {
//   InputValidationError,
//   reducePipeline,
//   mergeReaders,
// } from "@/blocks/combinators";
// import blockRegistry from "@/blocks/registry";
// import { Block, Reader } from "@/types";
// import { propertiesToSchema } from "@/validators/generic";
// import { BlockArg } from "@/core";
// import ConsoleLogger from "@/tests/ConsoleLogger";
// import { JQTransformer } from "@/blocks/transformers";
//
// const logger = new ConsoleLogger();
//
// class EchoBlock extends Block {
//   constructor() {
//     super("test/echo", "Echo Block");
//   }
//
//   inputSchema = propertiesToSchema({
//     message: {
//       type: "string",
//     },
//   });
//
//   async run({ message }: BlockArg) {
//     return { message };
//   }
// }
//
// class DumbReader extends Reader {
//   constructor() {
//     super("test/reader", "Dumb Reader");
//   }
//
//   async isAvailable(): Promise<boolean> {
//     return true;
//   }
//
//   outputSchema = propertiesToSchema({
//     message: {
//       type: "string",
//     },
//   });
//
//   async read() {
//     return { value: 42 };
//   }
// }
//
// const block = new EchoBlock();
// const reader = new DumbReader();
//
// beforeEach(() => {
//   blockRegistry.clear();
//   blockRegistry.register(block, reader);
// });

// test("reducePipeline can run a single block", async () => {
//   const pipelineConfig = {
//     id: block.id,
//     config: { message: "{{inputArg}}" },
//   };
//   const result = await reducePipeline(
//     pipelineConfig,
//     { inputArg: "hello" },
//     logger
//   );
//   expect(result).toStrictEqual({ message: "hello" });
// });
//
// test("reducePipeline throws error on wrong input type", async () => {
//   const pipelineConfig = {
//     id: block.id,
//     config: { message: "{{inputArg}}" },
//   };
//   try {
//     await reducePipeline(pipelineConfig, { inputArg: 42 }, logger);
//   } catch (exc) {
//     expect(exc).toBeInstanceOf(InputValidationError);
//   }
// });
//
// test("reducePipeline throws error on missing input", async () => {
//   const pipelineConfig = {
//     id: block.id,
//     config: { message: "{{inputArg}}" },
//   };
//   try {
//     await reducePipeline(pipelineConfig, {}, logger);
//   } catch (exc) {
//     expect(exc).toBeInstanceOf(InputValidationError);
//   }
// });
//
// test("reducePipeline supports output key", async () => {
//   const pipelineConfig = [
//     {
//       id: block.id,
//       outputKey: "foo",
//       config: { message: "{{inputArg}}" },
//     },
//     {
//       id: block.id,
//       config: { message: "hello, {{@foo.message}}" },
//     },
//   ];
//   const result = await reducePipeline(
//     pipelineConfig,
//     { inputArg: "bar" },
//     logger
//   );
//   expect(result).toStrictEqual({ message: "hello, bar" });
// });
//
// test("reducePipeline can pipeline outputs", async () => {
//   const pipelineConfig = [
//     {
//       id: block.id,
//       config: { message: "{{inputArg}}" },
//     },
//     {
//       id: block.id,
//       config: { message: "hello, {{message}}" },
//     },
//   ];
//   const result = await reducePipeline(
//     pipelineConfig,
//     { inputArg: "bar" },
//     logger
//   );
//   expect(result).toStrictEqual({ message: "hello, bar" });
// });
//
// test("merge single reader", async () => {
//   const block = new EchoBlock();
//   blockRegistry.register(block);
//   const merged = await mergeReaders(reader.id);
//   expect(await merged.read(document)).toStrictEqual({ value: 42 });
// });
//
// test("merge keyed readers", async () => {
//   const block = new EchoBlock();
//   blockRegistry.register(block);
//   const merged = await mergeReaders({
//     key1: reader.id,
//     key2: reader.id,
//   });
//   expect(await merged.read(document)).toStrictEqual({
//     key1: { value: 42 },
//     key2: { value: 42 },
//   });
// });
//
// test("merge array of readers", async () => {
//   const block = new EchoBlock();
//   blockRegistry.register(block);
//   const merged = await mergeReaders([reader.id, reader.id]);
//   expect(await merged.read(document)).toStrictEqual({ value: 42 });
// });
//
// test("outputKey preserves context", async () => {
//   const initialContext = { inputArg: "bar" };
//   const pipelineConfig = [
//     {
//       id: block.id,
//       outputKey: "foo",
//       config: { message: "inputArg" },
//     },
//   ];
//   const result = await reducePipeline(pipelineConfig, initialContext, logger);
//   expect(result).toStrictEqual(initialContext);
// });
//
// test("jq transform using context", async () => {
//   const jq = new JQTransformer();
//   blockRegistry.register(jq);
//
//   const initialContext = { array: [{ field: "foo" }] };
//   const pipelineConfig = [
//     {
//       id: block.id,
//       outputKey: "ignored",
//       config: { message: "inputArg" },
//     },
//     {
//       id: jq.id,
//       config: { filter: ".array | map(.field)" },
//     },
//   ];
//   const result = await reducePipeline(pipelineConfig, initialContext, logger);
//   expect(result).toStrictEqual(["foo"]);
// });
