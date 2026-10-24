type Cursor = { toArray(): Record<string, unknown>[]; readonly rowsRead?: number; readonly rowsWritten?: number };
type Sql = { exec(query: string, ...args: unknown[]): Cursor };

// Runtime scan diagnostics use the engine's counters, without additional SQL or
// telemetry writes. Arguments, account IDs, questions and results are omitted.
export function measuredSql(sql: Sql, clock = Date.now, report: (value: string) => void = value => console.warn(value)) {
  const reported = new Map<string, number>();
  return (query: string, ...args: unknown[]) => {
    const cursor = sql.exec(query, ...args), rows = cursor.toArray();
    const count = cursor.rowsRead || 0, now = clock();
    if (count >= 1000 && /^\s*SELECT\b/i.test(query) && (!reported.has(query) || now - reported.get(query)! >= 60_000)) {
      if (reported.size >= 64) reported.clear();
      reported.set(query, now);
      report(JSON.stringify({ event: "flora_sql_scan", queryTemplate: query.slice(0, 600), rowsRead: count, rowsWritten: cursor.rowsWritten || 0, rowsReturned: rows.length }));
    }
    return rows;
  };
}
