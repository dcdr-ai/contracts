import { ExecutionError } from "./errors.contract";
import { ExecutionContext, ExecutionReport, ExecutionStatus } from "./execution.contract";
import { Message } from "./messages.contract";



export type ExecutionLogEvent = ExecutionReport & {
  status: ExecutionStatus;
  input?: Message[];
  output?: unknown;
  error?: ExecutionError;
}; 