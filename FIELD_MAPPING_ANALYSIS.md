# BUG-001D — Field Mapping Analysis

## Userscript → Collector Mapping Table

| Userscript Section | Userscript Field | Existing Collector | Collector Field | Exists? |
|--------------------|------------------|--------------------|-----------------|---------|
| **SYSTEM** | Script version | collectDiagnostics() | version | ✅ |
| | Timestamp | — | — | **MISSING** |
| | Current URL | — | — | **MISSING** |
| | Browser | — | — | **MISSING** |
| | UserAgent | — | — | **MISSING** |
| | Viewport | — | — | **MISSING** |
| **PROFILE** | Detected profiles | — | — | **MISSING** |
| | Selected profile | — | — | **MISSING** |
| | Storage key | — | — | **MISSING** |
| | Profile size | collectStorageData() | Profile Size* | PARTIAL |
| | Backup exists | — | — | **MISSING** |
| | Estimated localStorage usage | collectStorageData() | Quota Usage* | PARTIAL |
| **RUNTIME** | Booster UI opened | collectDomData() | Dashboard Open* | PARTIAL |
| | START button | collectDomData() | Start Button* | PARTIAL |
| | STOP button | collectDomData() | Stop Button* | PARTIAL |
| **PROFILE STRUCTURE** | messages | — | — | **MISSING** |
| | broadcast.messages | — | — | **MISSING** |
| | chainProgress | — | — | **MISSING** |
| | delivered | — | — | **MISSING** |
| | sended | — | — | **MISSING** |
| | broadcast | — | — | **MISSING** |
| **PROGRESS SOURCE** | IceBreaker completed | collectResetData() | Completed Count* | PARTIAL |
| | Broadcast completed | — | — | **MISSING** |
| **STORAGE** | status | collectRuntimeData() | IceBreaker Status | ✅ |
| | broadcast.status | collectRuntimeData() | Broadcast Status | ✅ |
| | chainProgress size | collectResetData() | In-Progress Count* | PARTIAL |
| | delivered size | collectResetData() | Delivered Count* | PARTIAL |
| | sended size | collectResetData() | Completed Count* | PARTIAL |
| **DOM** | Accessible documents | — | — | **MISSING** |
| | Accessible iframes | — | — | **MISSING** |
| | Blocked iframes | — | — | **MISSING** |
| | ShadowRoots | — | — | **MISSING** |
| | Buttons scanned | — | — | **MISSING** |
| **HEALTH CHECK** | Profile | — | — | **MISSING** |
| | Storage | — | — | **MISSING** |
| | UI Hooks | — | — | **MISSING** |
| | IceBreaker | collectRuntimeData() | IceBreaker Status | ✅ |
| | Broadcast | collectRuntimeData() | Broadcast Status | ✅ |
| | Overall | — | — | **MISSING** |

*PARTIAL = collector has related data but different format/name

---

## Missing Fields by Collector Ownership

### collectRuntimeMapData — owns runtime/browser metadata
- **SYSTEM**: Timestamp, Current URL, Browser, UserAgent, Viewport

### collectStorageData — owns profile/storage metadata
- **PROFILE**: Detected profiles, Selected profile, Storage key, Profile size (exact), Backup exists, Estimated localStorage usage (exact KB)

### collectDomData — owns DOM/UI state
- **RUNTIME**: Booster UI opened (→ Dashboard Open), START button (→ Start Button), STOP button (→ Stop Button)
- **DOM**: Accessible documents, Accessible iframes, Blocked iframes, ShadowRoots, Buttons scanned

### collectLiveReaderData — owns profile structure presence
- **PROFILE STRUCTURE**: messages, broadcast.messages, chainProgress, delivered, sended, broadcast (all FOUND/NOT FOUND)

### collectResetData — owns progress counters
- **PROGRESS SOURCE**: IceBreaker completed (→ Completed Count), Broadcast completed (MISSING - needs broadcast completed count)
- **STORAGE**: chainProgress size (→ In-Progress Count), delivered size (→ Delivered Count), sended size (→ Completed Count)

### collectRuntimeData — owns health status
- **HEALTH CHECK**: Profile, Storage, UI Hooks, Overall

---

## Required Collector Extensions

1. **collectRuntimeMapData** → add: Timestamp, Current URL, Browser, UserAgent, Viewport
2. **collectStorageData** → add: Detected profiles, Selected profile, Storage key, Profile size (JSON-based), Backup exists, Estimated localStorage usage (KB)
3. **collectDomData** → add: Accessible iframes, Blocked iframes, ShadowRoots, Buttons scanned; rename Dashboard Open→Booster UI opened, Start Button→START button, Stop Button→STOP button
4. **collectLiveReaderData** → add: messages, broadcast.messages, chainProgress, delivered, sended, broadcast (FOUND/NOT FOUND)
5. **collectResetData** → add: Broadcast Completed count
5. **collectRuntimeData** → add: Profile health, Storage health, UI Hooks health, Overall health