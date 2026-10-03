/** K3 always thinks; use its supported controls for short, bounded explanations.
 * https://platform.kimi.ai/docs/guide/kimi-k3-quickstart
 */
export function kimiGenerationOptions(model: string, maxTokens = 4096) {
  return model === "kimi-k3"
    ? { reasoning_effort: "low", max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}
