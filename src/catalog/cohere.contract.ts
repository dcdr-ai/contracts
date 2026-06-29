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
 * Returns the curated Cohere provider model definitions.
 */
export function buildCohereProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [];
}

/**
 * Returns the E2E override map for Cohere provider models.
 */
export function buildCohereProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}

