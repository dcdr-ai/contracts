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
 * Returns the curated OCR provider model definitions.
 */
export function buildOcrProviderModelDefinitions(
  args: ProviderCatalogModuleBuildArgs,
): ProviderModelDefinitionInput[] {

  return [];
}

/**
 * Returns the E2E override map for OCR provider models.
 */
export function buildOcrProviderModelE2EOverrides(
  args: ProviderCatalogModuleBuildArgs,
): Record<string, ProviderModelE2EOverride> {
  return {};
}

