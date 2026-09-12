// Fire-and-forget client helper to log admin/signed-in access to sensitive
// product fields (cogs, supplier_*). Errors are swallowed so UI flows are
// never blocked by audit logging.
import { logSensitiveAccess } from "@/lib/audit-log.functions";

export function recordSensitiveAccess(input: {
  table_name: string;
  fields: string[];
  record_ids?: string[];
  context?: string;
  row_count?: number;
}) {
  try {
    void logSensitiveAccess({ data: input }).catch(() => {});
  } catch {
    // ignore
  }
}
