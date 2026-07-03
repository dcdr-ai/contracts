import {
  AssetType as ExecutionPartType,
  ExecutionPartSourceKind,
} from "./execution.contract";

/**
 * Stable semantic family used by the tracked-call rating matrix.
 *
 * Notes
 * - This is intentionally narrower than the full execution/report domain.
 * - Values align with `ExecutionPartType` so UI and runtime can map directly.
 */
export enum TrackedCallRatingAssetFamily {
  TEXT = "text",
  DOCUMENT = "document",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
}

/**
 * Source-family selector used by tracked-call rating buckets.
 */
export enum TrackedCallRatingSourceKind {
  ANY = "ANY",
  INLINE = "INLINE",
  URL = "URL",
  ASSET = "ASSET",
}

/**
 * Bucket matching mode used by tracked-call rating rows.
 */
export enum TrackedCallRatingBucketKind {
  ANY_SIZE = "ANY_SIZE",
  SIZE_RANGE = "SIZE_RANGE",
  UNKNOWN_SIZE = "UNKNOWN_SIZE",
}

/**
 * Lifecycle status for a tracked-call rating matrix snapshot.
 */
export enum TrackedCallRatingMatrixStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  DEPRECATED = "DEPRECATED",
}

/**
 * Combination rule used when multiple multimodal parts are present.
 */
export enum TrackedCallRatingCombinationStrategy {
  MAX_BUCKET = "MAX_BUCKET",
}

/**
 * One rated bucket row inside the tracked-call matrix.
 */
export interface TrackedCallRatingBucket {
  /** Stable row identifier for UI/debugging. */
  id: string;

  /** Rated semantic family. */
  assetFamily: TrackedCallRatingAssetFamily;

  /** Applicable source kind or `ANY`. */
  sourceKind: TrackedCallRatingSourceKind;

  /** Matching mode for this bucket. */
  bucketKind: TrackedCallRatingBucketKind;

  /** Inclusive lower bound when `bucketKind=SIZE_RANGE`. */
  minSizeBytes?: number;

  /** Exclusive upper bound when `bucketKind=SIZE_RANGE`. */
  maxSizeBytesExclusive?: number;

  /** Applied tracked-call multiplier. */
  multiplier: number;

  /** Stable reason stored in execution reports. */
  reason: string;

  /** Optional human note for UI/docs. */
  notes?: string;
}

/**
 * Aggregate floor row used to prevent large batches of small parts from rating
 * like trivial requests.
 */
export interface TrackedCallAggregateGuardrailBucket {
  /** Stable row identifier for UI/debugging. */
  id: string;

  /** Inclusive lower bound for known non-text aggregate bytes. */
  minTotalNonTextBytes?: number;

  /** Exclusive upper bound for known non-text aggregate bytes. */
  maxTotalNonTextBytesExclusive?: number;

  /** Minimum final multiplier enforced by this guardrail. */
  minMultiplier: number;

  /** Stable reason/context for auditability. */
  reason: string;
}

/**
 * Declarative tracked-call rating matrix shared by runtime and backend/UI.
 */
export interface TrackedCallRatingMatrix {
  /** Stable matrix identifier. */
  id: string;

  /** Version string used for auditability. */
  version: string;

  /** Lifecycle status for this matrix snapshot. */
  status: TrackedCallRatingMatrixStatus;

  /** Base tracked-call count before multipliers. */
  baseTrackedCalls: number;

  /** Combination rule used across multiple parts. */
  mixedModalityStrategy: TrackedCallRatingCombinationStrategy;

  /** Bucket rows matched against individual parts. */
  buckets: TrackedCallRatingBucket[];

  /** Optional aggregate non-text size floors. */
  aggregateGuardrails?: TrackedCallAggregateGuardrailBucket[];

  /** Optional explanatory notes for UI/docs. */
  notes?: string[];
}

const KB = 1024;
const MB = 1024 * 1024;

/**
 * Default tracked-call rating matrix for multimodal v1.
 *
 * Notes
 * - Keeps the public unit as tracked calls.
 * - Uses bounded, auditable size buckets instead of continuous formulas.
 * - Intended to be shared by runtime, backend, and UI.
 */
export const DEFAULT_TRACKED_CALL_RATING_MATRIX_V1: TrackedCallRatingMatrix = {
  id: "default-multimodal-tracked-calls-v1",
  version: "1.0",
  status: TrackedCallRatingMatrixStatus.ACTIVE,
  baseTrackedCalls: 1,
  mixedModalityStrategy: TrackedCallRatingCombinationStrategy.MAX_BUCKET,
  buckets: [
    {
      id: "text-any",
      assetFamily: TrackedCallRatingAssetFamily.TEXT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.ANY_SIZE,
      multiplier: 1,
      reason: "text_any_size",
      notes: "Text remains 1.0x in v1 and is governed by separate token/size limits.",
    },
    {
      id: "document-lt-1mb",
      assetFamily: TrackedCallRatingAssetFamily.DOCUMENT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 0,
      maxSizeBytesExclusive: 1 * MB,
      multiplier: 1,
      reason: "document_size_lt_1mb",
    },
    {
      id: "document-1mb-10mb",
      assetFamily: TrackedCallRatingAssetFamily.DOCUMENT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 1 * MB,
      maxSizeBytesExclusive: 10 * MB,
      multiplier: 1.5,
      reason: "document_size_1mb_10mb",
    },
    {
      id: "document-10mb-50mb",
      assetFamily: TrackedCallRatingAssetFamily.DOCUMENT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 10 * MB,
      maxSizeBytesExclusive: 50 * MB,
      multiplier: 2,
      reason: "document_size_10mb_50mb",
    },
    {
      id: "document-gte-50mb",
      assetFamily: TrackedCallRatingAssetFamily.DOCUMENT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 50 * MB,
      multiplier: 3,
      reason: "document_size_gte_50mb",
    },
    {
      id: "document-unknown",
      assetFamily: TrackedCallRatingAssetFamily.DOCUMENT,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.UNKNOWN_SIZE,
      multiplier: 1.5,
      reason: "document_size_unknown",
    },
    {
      id: "image-lt-512kb",
      assetFamily: TrackedCallRatingAssetFamily.IMAGE,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 0,
      maxSizeBytesExclusive: 512 * KB,
      multiplier: 1,
      reason: "image_size_lt_512kb",
    },
    {
      id: "image-512kb-5mb",
      assetFamily: TrackedCallRatingAssetFamily.IMAGE,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 512 * KB,
      maxSizeBytesExclusive: 5 * MB,
      multiplier: 1.5,
      reason: "image_size_512kb_5mb",
    },
    {
      id: "image-gte-5mb",
      assetFamily: TrackedCallRatingAssetFamily.IMAGE,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 5 * MB,
      multiplier: 2,
      reason: "image_size_gte_5mb",
    },
    {
      id: "image-unknown",
      assetFamily: TrackedCallRatingAssetFamily.IMAGE,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.UNKNOWN_SIZE,
      multiplier: 1.5,
      reason: "image_size_unknown",
    },
    {
      id: "audio-lt-1mb",
      assetFamily: TrackedCallRatingAssetFamily.AUDIO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 0,
      maxSizeBytesExclusive: 1 * MB,
      multiplier: 1.25,
      reason: "audio_size_lt_1mb",
    },
    {
      id: "audio-1mb-10mb",
      assetFamily: TrackedCallRatingAssetFamily.AUDIO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 1 * MB,
      maxSizeBytesExclusive: 10 * MB,
      multiplier: 2,
      reason: "audio_size_1mb_10mb",
    },
    {
      id: "audio-gte-10mb",
      assetFamily: TrackedCallRatingAssetFamily.AUDIO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 10 * MB,
      multiplier: 3,
      reason: "audio_size_gte_10mb",
    },
    {
      id: "audio-unknown",
      assetFamily: TrackedCallRatingAssetFamily.AUDIO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.UNKNOWN_SIZE,
      multiplier: 2,
      reason: "audio_size_unknown",
    },
    {
      id: "video-lt-5mb",
      assetFamily: TrackedCallRatingAssetFamily.VIDEO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 0,
      maxSizeBytesExclusive: 5 * MB,
      multiplier: 2,
      reason: "video_size_lt_5mb",
    },
    {
      id: "video-5mb-100mb",
      assetFamily: TrackedCallRatingAssetFamily.VIDEO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 5 * MB,
      maxSizeBytesExclusive: 100 * MB,
      multiplier: 3,
      reason: "video_size_5mb_100mb",
    },
    {
      id: "video-gte-100mb",
      assetFamily: TrackedCallRatingAssetFamily.VIDEO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.SIZE_RANGE,
      minSizeBytes: 100 * MB,
      multiplier: 4,
      reason: "video_size_gte_100mb",
    },
    {
      id: "video-unknown",
      assetFamily: TrackedCallRatingAssetFamily.VIDEO,
      sourceKind: TrackedCallRatingSourceKind.ANY,
      bucketKind: TrackedCallRatingBucketKind.UNKNOWN_SIZE,
      multiplier: 3,
      reason: "video_size_unknown",
    },
  ],
  aggregateGuardrails: [
    {
      id: "aggregate-non-text-10mb-50mb",
      minTotalNonTextBytes: 10 * MB,
      maxTotalNonTextBytesExclusive: 50 * MB,
      minMultiplier: 1.5,
      reason: "aggregate_non_text_size_10mb_50mb",
    },
    {
      id: "aggregate-non-text-50mb-200mb",
      minTotalNonTextBytes: 50 * MB,
      maxTotalNonTextBytesExclusive: 200 * MB,
      minMultiplier: 2,
      reason: "aggregate_non_text_size_50mb_200mb",
    },
    {
      id: "aggregate-non-text-gte-200mb",
      minTotalNonTextBytes: 200 * MB,
      minMultiplier: 3,
      reason: "aggregate_non_text_size_gte_200mb",
    },
  ],
  notes: [
    "Uses max-bucket rating plus an aggregate non-text size floor.",
    "Does not fetch remote URLs or managed assets only for rating.",
    "Tracked-call multipliers may be fractional and should be aggregated before rounding.",
  ],
};

/**
 * Returns the default tracked-call rating matrix used by runtime v1.
 */
export function getDefaultTrackedCallRatingMatrix(): TrackedCallRatingMatrix {
  return DEFAULT_TRACKED_CALL_RATING_MATRIX_V1;
}

/**
 * Maps an execution part type to the tracked-call family when the domains align.
 */
export function toTrackedCallRatingAssetFamily(
  value: ExecutionPartType,
): TrackedCallRatingAssetFamily | null {
  switch (value) {
    case ExecutionPartType.TEXT:
      return TrackedCallRatingAssetFamily.TEXT;
    case ExecutionPartType.DOCUMENT:
      return TrackedCallRatingAssetFamily.DOCUMENT;
    case ExecutionPartType.IMAGE:
      return TrackedCallRatingAssetFamily.IMAGE;
    case ExecutionPartType.AUDIO:
      return TrackedCallRatingAssetFamily.AUDIO;
    case ExecutionPartType.VIDEO:
      return TrackedCallRatingAssetFamily.VIDEO;
    default:
      return null;
  }
}

/**
 * Maps the execution source kind into the tracked-call matrix domain.
 */
export function toTrackedCallRatingSourceKind(
  value?: ExecutionPartSourceKind,
): TrackedCallRatingSourceKind {
  switch (value) {
    case ExecutionPartSourceKind.INLINE:
      return TrackedCallRatingSourceKind.INLINE;
    case ExecutionPartSourceKind.URL:
      return TrackedCallRatingSourceKind.URL;
    case ExecutionPartSourceKind.ASSET:
      return TrackedCallRatingSourceKind.ASSET;
    default:
      return TrackedCallRatingSourceKind.ANY;
  }
}
