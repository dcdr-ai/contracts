import { ExecutionErrorCode, createExecutionError, isExecutionError, toErrorMessage } from "../src/errors.contract";

/**
 * What a caller is told when something fails.
 *
 * This suite exists because of a bug that was live in ten places across four routers, and that only
 * surfaced while debugging something else: every API response carrying an `ExecutionError` said
 * **`"[object Object]"`**. The code was right, the message was gone, and the person reading it
 * learned nothing at all.
 *
 * The cause is worth remembering, because the line that caused it is one everybody writes:
 * `error instanceof Error ? error.message : String(error)`. It is wrong for exactly the errors this
 * runtime raises deliberately - `createExecutionError` returns a **plain object**, on purpose,
 * because `ExecutionError` is a wire type as much as a thrown one and `Error.message` is
 * non-enumerable, so a class would make `JSON.stringify` of one produce `{}`.
 */
describe("error messages", () => {
  describe("isExecutionError", () => {
    it("recognises one by shape, because that is the only test that holds", () => {
      // Not `instanceof`: these are built as literals as often as through the factory, and they
      // cross the wire, where any class identity is lost anyway.
      expect(isExecutionError(createExecutionError(ExecutionErrorCode.BAD_REQUEST, "nope"))).toBe(true);
      expect(isExecutionError({ code: ExecutionErrorCode.CONFIG_ERROR, message: "literal" })).toBe(true);
      expect(isExecutionError(JSON.parse(JSON.stringify(createExecutionError(ExecutionErrorCode.BAD_REQUEST, "round trip"))))).toBe(true);
    });

    it("refuses anything that only looks like one", () => {
      expect(isExecutionError(new Error("plain error"))).toBe(false);
      expect(isExecutionError({ code: "NOT_A_REAL_CODE", message: "x" })).toBe(false);
      expect(isExecutionError({ code: ExecutionErrorCode.BAD_REQUEST })).toBe(false);
      expect(isExecutionError(null)).toBe(false);
      expect(isExecutionError("a string")).toBe(false);
    });
  });

  describe("toErrorMessage", () => {
    it("gets the message out of an execution error, which was the whole bug", () => {
      const error = createExecutionError(ExecutionErrorCode.PROVIDER_ERROR, "Failed to resolve asset storage credentials (status=500).");
      expect(toErrorMessage(error)).toBe("Failed to resolve asset storage credentials (status=500).");
      expect(toErrorMessage(error)).not.toBe("[object Object]");
    });

    it("still does the ordinary things", () => {
      expect(toErrorMessage(new Error("boom"))).toBe("boom");
      expect(toErrorMessage("already a string")).toBe("already a string");
    });

    it("never answers `[object Object]`, whatever it is handed", () => {
      // The property that matters more than any single case: a caller debugging a failure must
      // always get *something*, and an unplanned shape is not an excuse to say nothing.
      const circular: Record<string, unknown> = { note: "circular" };
      circular.self = circular;

      for (const value of [{ unexpected: "shape" }, [1, 2, 3], circular, new Error(""), 42, true]) {
        expect(toErrorMessage(value)).not.toBe("[object Object]");
        expect(toErrorMessage(value).length).toBeGreaterThan(0);
      }
    });

    it("keeps an execution error serialisable, which is why it is not a class", () => {
      // The reason the fix went into the reader rather than into `createExecutionError`: making it
      // an `Error` subclass would satisfy `instanceof` and quietly empty every response that
      // serialises one, because `message` on an `Error` is non-enumerable.
      const asError = new Error("message on a real Error");
      expect(JSON.stringify(asError)).toBe("{}");

      const executionError = createExecutionError(ExecutionErrorCode.BAD_REQUEST, "message on an ExecutionError");
      expect(JSON.parse(JSON.stringify(executionError)).message).toBe("message on an ExecutionError");
    });
  });
});
