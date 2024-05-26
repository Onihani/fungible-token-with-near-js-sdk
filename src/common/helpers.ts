import { PromiseIndex, near } from "near-sdk-js";

export function encodeNonStringFields(
  data: Record<string, any>
): Record<string, string> {
  const encodedData: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = String(value);
  }

  return encodedData;
}

export function promiseResult(): { result?: string; success: boolean } {
  let result: string | undefined, success: boolean;

  try {
    result = near.promiseResult(0 as PromiseIndex);
    success = true;
  } catch {
    result = undefined;
    success = false;
  }

  return { result, success };
}

export function findMinValue(...numbers: bigint[]): bigint {
  return numbers.reduce(
    (min, current) => (current < min ? current : min),
    numbers[0]
  );
}
