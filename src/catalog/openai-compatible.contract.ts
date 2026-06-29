import { AssetType } from "../asset.contract";
import { ExecutionPartSourceKind } from "../execution.contract";
import { IntentType } from "../intent.contract";
import type {
  ProviderCatalogModuleBuildArgs,
  ProviderModelDefinitionInput,
  ProviderModelE2EOverride,
  ProviderModelInputPartsSupportInfo,
  ProviderModelParameterSupportInfo,
} from "../provider.catalog.contract";

/**
 * Returns the curated OpenAI-compatible provider model definitions.
 */
export function buildOpenAICompatibleProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [];
}

/**
 * Returns the E2E override map for OpenAI-compatible provider models.
 */
export function buildOpenAICompatibleProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}

