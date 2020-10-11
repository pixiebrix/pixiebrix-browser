import { reportError } from "@/telemetry/logging";

/** An error boundary for renderers */
export async function errorBoundary(
  renderPromise: Promise<string>
): Promise<string> {
  try {
    return await renderPromise;
  } catch (exc) {
    // Intentionally don't block on error telemetry
    // eslint-disable-next-line require-await
    reportError(exc);
    return `<div>An error occurred: ${exc.toString()}</div>`;
  }
}
