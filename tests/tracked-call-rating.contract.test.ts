import {
  DEFAULT_TRACKED_CALL_RATING_MATRIX_V1,
  getDefaultTrackedCallRatingMatrix,
  TrackedCallRatingAssetFamily,
  TrackedCallRatingBucketKind,
  TrackedCallRatingCombinationStrategy,
  TrackedCallRatingMatrixStatus,
} from "../src/tracked-call-rating.contract";

describe("tracked-call rating matrix contract", () => {
  it("exports one active default matrix with bounded buckets", () => {
    const matrix = getDefaultTrackedCallRatingMatrix();

    expect(matrix).toBe(DEFAULT_TRACKED_CALL_RATING_MATRIX_V1);
    expect(matrix.status).toBe(TrackedCallRatingMatrixStatus.ACTIVE);
    expect(matrix.baseTrackedCalls).toBe(1);
    expect(matrix.mixedModalityStrategy).toBe(
      TrackedCallRatingCombinationStrategy.MAX_BUCKET,
    );
    expect(matrix.buckets.some((bucket) => bucket.multiplier % 1 !== 0)).toBe(
      true,
    );
  });

  it("covers text, document, image, audio, and video families", () => {
    const families = new Set(
      DEFAULT_TRACKED_CALL_RATING_MATRIX_V1.buckets.map(
        (bucket) => bucket.assetFamily,
      ),
    );

    expect(families).toEqual(
      new Set([
        TrackedCallRatingAssetFamily.TEXT,
        TrackedCallRatingAssetFamily.DOCUMENT,
        TrackedCallRatingAssetFamily.IMAGE,
        TrackedCallRatingAssetFamily.AUDIO,
        TrackedCallRatingAssetFamily.VIDEO,
      ]),
    );
  });

  it("keeps unknown-size buckets and aggregate guardrails explicit", () => {
    expect(
      DEFAULT_TRACKED_CALL_RATING_MATRIX_V1.buckets.some(
        (bucket) =>
          bucket.bucketKind === TrackedCallRatingBucketKind.UNKNOWN_SIZE,
      ),
    ).toBe(true);
    expect(
      DEFAULT_TRACKED_CALL_RATING_MATRIX_V1.aggregateGuardrails?.length ?? 0,
    ).toBeGreaterThan(0);
  });
});
