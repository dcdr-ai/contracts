/**
 * Supported message roles for chat-style prompts.
 * Keep this provider-agnostic; each provider adapter will map it as needed.
 */
//export type MessageRole = "system" | "developer" | "user" | "assistant" | "tool";
export type MessageRole = "system" | "user" ;

/**
 * A single prompt message in a provider-agnostic format.
 * - `content` can include `${placeholders}` to be rendered by the gateway.
 * - `name` is optional and mainly used for tool messages or multi-agent style.
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
}
