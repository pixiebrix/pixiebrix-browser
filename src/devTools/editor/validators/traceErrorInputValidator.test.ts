import { traceErrorFactory } from "@/tests/factories";
import traceErrorInputValidator from "./traceErrorInputValidator";

test("ignores non input errors", () => {
  const pipelineErrors: Record<string, any> = {};
  const errorTraceEntry = traceErrorFactory();

  const hasInputErrors = traceErrorInputValidator(
    pipelineErrors,
    errorTraceEntry,
    0
  );

  expect(hasInputErrors).toBe(false);
  expect(pipelineErrors).toEqual({});
});

test("figures required property error", () => {
  const pipelineErrors: Record<string, unknown> = {};
  const property = "testProp";
  const traceError = {
    schema: {},
    errors: [
      {
        error: `Instance does not have required property "${property}".`,
      },
    ],
  };
  const errorTraceEntry = traceErrorFactory({
    error: traceError,
  });

  const hasInputErrors = traceErrorInputValidator(
    pipelineErrors,
    errorTraceEntry,
    0
  );

  expect(hasInputErrors).toBe(true);
  // @ts-expect-error -- pipelineErrors[0] has 'config'
  expect(pipelineErrors[0].config[property]).toEqual(
    "Error from the last run: This field is required"
  );
});

test("sets unknown input error on the block level", () => {
  const pipelineErrors: Record<string, unknown> = {};
  const errorMessage = "This is an unknown input validation error";
  const traceError = {
    schema: {},
    errors: [
      {
        error: errorMessage,
      },
    ],
  };
  const errorTraceEntry = traceErrorFactory({
    error: traceError,
  });

  const hasInputErrors = traceErrorInputValidator(
    pipelineErrors,
    errorTraceEntry,
    0
  );

  expect(hasInputErrors).toBe(true);
  expect(pipelineErrors[0]).toEqual(errorMessage);
});
