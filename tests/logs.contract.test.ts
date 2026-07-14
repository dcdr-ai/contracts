/// <reference types="jest" />

import {
  ExecutionLogEvent,
  ExecutionLogMode,
  GatewayLogResolutionKind,
  GatewayLogSurface,
} from "../src/logs.contract";
import { ExecutionStatus } from "../src/execution.contract";
import { IntentProvider } from "../src/provider.contract";

describe("logs.contract", () => {
  it("supports a gateway-compatible execution log envelope without full intent report fields", () => {
    const event: ExecutionLogEvent = {
      executionMode: ExecutionLogMode.GATEWAY,
      status: ExecutionStatus.OK,
      gateway: {
        surface: GatewayLogSurface.RESPONSES,
        route: "/v1/responses",
        httpStatus: 200,
        requestedModel: "gpt-4.1-nano",
        resolvedProvider: IntentProvider.OPEN_AI,
        resolvedModel: "gpt-4.1-nano",
        resolutionKind: GatewayLogResolutionKind.DIRECT,
      },
    };

    expect(event.executionMode).toBe(ExecutionLogMode.GATEWAY);
    expect(event.gateway?.surface).toBe(GatewayLogSurface.RESPONSES);
    expect(event.gateway?.resolutionKind).toBe(
      GatewayLogResolutionKind.DIRECT,
    );
  });
});
