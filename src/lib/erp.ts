/** Future ERP boundary: read-only snapshots; no automatic inventory adjustments. */
export interface ExpectedInventoryRow {
  sku: string;
  location: string;
  expected_quantity: string;
  serials: string;
}
export interface ErpSnapshot {
  source: string;
  capturedAt: string;
  rows: ExpectedInventoryRow[];
}
export interface ErpAdapter {
  fetchSnapshot(locationExternalId: string): Promise<ErpSnapshot>;
}
export function snapshotForImport(snapshot: ErpSnapshot) {
  if (!snapshot.source || !Number.isFinite(Date.parse(snapshot.capturedAt)))
    throw new Error("Instantánea ERP inválida");
  return {
    rows: snapshot.rows,
    source: snapshot.source,
    captured_at: snapshot.capturedAt,
  };
}
