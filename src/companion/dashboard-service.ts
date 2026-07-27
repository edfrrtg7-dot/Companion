/**
 * DashboardService
 *
 * Centralized CRM profile access for the Dashboard tab.
 * Isolates localStorage access behind a typed API.
 *
 * Responsibilities:
 *   - Locate the active CRM profile key
 *   - Read and parse profile data
 *   - Return null on invalid or missing data
 *
 * No caching. No field resolution. No UI logic.
 */

import { CrmService } from "./crm-service";

type ProfileData = Record<string, unknown> | null;

export class DashboardService {
    static readCRMData(): ProfileData {
        try {
            const key = CrmService.findProfileKey();
            if (!key) return null;
            return CrmService.readProfile(key);
        } catch {
            return null;
        }
    }
}
