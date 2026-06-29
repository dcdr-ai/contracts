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
 * Returns the curated HTTP tool provider model definitions.
 */
export function buildHttpToolProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [];
}

/**
 * Returns the E2E override map for HTTP tool provider models.
 */
export function buildHttpToolProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}

