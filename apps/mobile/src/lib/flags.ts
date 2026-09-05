// Feature flags (spec 6.3): experimental features are separated so a failure
// never touches the core flow. Kill a flag via env without a code change.
const off = (value: string | undefined) => value === "0" || value === "false";

export const shelfScanEnabled = !off(process.env.EXPO_PUBLIC_FF_SHELF_SCAN);
