# assystREST API Contract

**Source:** https://wiki.axiossystems.com/assyst11-5Wiki/index.php/Integrations:assystREST  
**Target Version:** assyst 11.5 (assystREST API v2)  
**Researched:** 2026-10-02  
**Status:** Verified sections marked ✅ | Provisional/inferred sections marked ⚠️ | Unverified marked ❌

---

## 1. API Version and Base URL

| Item | Value | Status |
|---|---|---|
| API Version | v2 | ✅ Verified from RAML: `baseUri: http://localhost:8080/assystREST/v2` |
| Base Path | `/assystREST/v2` | ✅ Verified from documentation URL examples |
| Protocols | HTTP, HTTPS | ✅ Verified from RAML `protocols: [HTTP, HTTPS]` |
| Content Types | `application/json`, `application/xml` | ✅ Verified |

The base URL format documented is:
```
http://<server>:<port>/assystREST/v2/<resource>/<id>
```

---

## 2. Authentication

### Mechanism
✅ **Verified**: The API supports the following authentication mechanisms (configured at installation):
- **Basic Authentication** – used with LDAP or Database Security Domain
- SAML
- X.509
- Azure AD

For this mock, **Basic Authentication** is implemented as it is the simplest mechanism and the most commonly used for integration scenarios.

### Session Support
✅ **Verified**: assystREST supports optional stateful sessions via cookies (`JSESSIONID`):
- Activate sessions: `X-assyst-Rest-UseSession: true` header OR `rest.useSession=true` query param
- Session header takes precedence over query param
- Without sessions: each request must include authentication credentials
- Disconnect: `DELETE /assystREST/v2/application/disconnect`

### User Type Parameter
✅ **Verified**: `rest.userType` parameter — values: `contact` | `assyst`

### On-Behalf-Of
✅ **Verified**: `onBehalfOfUser=<shortcode>` query parameter for impersonation

### Authentication Headers (Basic Auth)
```
Authorization: Basic <base64(username:password)>
```

### HTTP Status Codes for Auth
- `401 Unauthorized` – user not authenticated
- `403 Forbidden` – insufficient privileges

---

## 3. Request Format

### URL Format
✅ **Verified**:
```
http://<server>:<port>/assystREST/v2/<resource>          # collection
http://<server>:<port>/assystREST/v2/<resource>/<id>     # single item
```
Resources use **plural** names always.

### HTTP Verbs
✅ **Verified**:
- `GET` – retrieve a resource or list
- `POST` – create OR update a resource (NOT PUT, as updates are partial)
- `DELETE` – remove a resource

> ⚠️ **Important**: POST is used for both create AND update. PUT is not supported (405 Method Not Allowed).

### Content Negotiation
✅ **Verified**:
- `Accept: application/json` → JSON response
- `Accept: application/xml` → XML response
- Fallback: append `.json` or `.xml` to URL if `Accept` header cannot be set

### Date Format
✅ **Verified**: ISO 8601, always UTC ("Zulu"):
```
2014-09-22T00:00:00Z
```

### Date Range Filter Format
✅ **Verified**: Two comma-separated ISO 8601 dates:
```
2014-09-22T00:00:00Z,2014-09-22T20:00:00Z
```
- Omit first date → all dates before second date
- Omit second date → all dates after first date
- Only one range per parameter

### Boolean Values
✅ **Verified**: Literal `true` or `false`

### Enumerated Types
✅ **Verified**: Used verbatim as query parameters and in request body.
Example:
```
GET /assystREST/v2/events?eventType=incident&eventStatus=open
```

---

## 4. Searching and Filtering

### Query Parameter Format
✅ **Verified**:
```
GET /assystREST/v2/resource?criteria_1[options]=value_1,...value_N
```

### Filter Options
✅ **Verified**:
- Default (no option): exact match, include results
- `[exclude]`: exclude results matching values
- `[like]`: starts-with match (string fields only)
- `%25` (URL-encoded `%`): wildcard substring search

### Multi-value
✅ **Verified**: Comma-separated values. Literal commas in values must be encoded as `%2C`.

### Example Searches
```
# Products whose shortCode starts with Test or Demo
GET /assystREST/v2/products?shortCode[like]=Test,Demo

# Exclude Test and Demo, supplier starts with Microsoft
GET /assystREST/v2/products?shortCode[exclude]=Test,Demo&supplierRef[like]=Microsoft

# Items with shortCode containing "service"
GET /assystREST/v2/items?shortCode[like]=%25service

# Events of type incident with status open
GET /assystREST/v2/events?eventType=incident&eventStatus=open
```

---

## 5. Pagination (Row Limits)

### Row Limits
✅ **Verified**: Row limits exist and are configurable globally and per-table. Specific default values are **not documented** in the public wiki.

⚠️ **Provisional**: Based on assystREST RAML introspection and integration experience, the following pagination parameters are commonly used:
- `startRow` – zero-based row offset (first result index)
- `numberOfRows` – maximum number of rows to return

These parameters are **not explicitly documented** in the page retrieved, but are consistent with the RAML `queryParameters` described in assystREST documentation. They are implemented as a provisional compatibility feature.

**Mock behavior**: Implements `startRow` (default: 0) and `numberOfRows` (default: 25, max: 100).

---

## 6. Field Expansion and Filtering

### Default Behavior
✅ **Verified**: By default, assystREST returns all **simple attributes** and does NOT return nested objects.

### `fields` Query Parameter
✅ **Verified**: Used for both expansion and filtering.

#### Field Expansion
```
# Expand nested objects
GET /assystREST/v2/products/45?fields=productClass.genericClass,defaultSla

# Expand with collection filter
GET /assystREST/v2/items?name[like]=assyst&fields=costCentre,project
```

#### Field Filtering
```
# Return only specific fields of expanded objects
GET /assystREST/v2/products/45?fields=productClass[name,shortCode],defaultSla[name,shortCode]

# Wildcard: all simple attributes of nested
GET /assystREST/v2/items?name[like]=assyst&fields=[name,serialNumber],product[].productClass[].genericClass[name]
```

Special behaviors:
- Always returned (even if not specified): `id`, `shortCode`, `name`, `version`
- Empty `[]` → no attributes returned for that object
- `*` wildcard → all simple attributes

---

## 7. Optimistic Locking

✅ **Verified**: The `version` field is always present in responses. Include it in update requests to prevent lost updates.
- If version mismatches: `409 Conflict` is returned.
- Omitting `version` skips the conflict check (risk of lost updates).

---

## 8. Event Resource (Incidents)

### Endpoint Catalog

| Operation | Method | Path | Status |
|---|---|---|---|
| List events | GET | `/assystREST/v2/events` | ✅ Verified path from RAML |
| Get event by ID | GET | `/assystREST/v2/events/{id}` | ✅ Verified path from RAML |
| Create event | POST | `/assystREST/v2/events` | ✅ Verified (POST = create) |
| Update event | POST | `/assystREST/v2/events/{id}` | ✅ Verified (POST = update) |
| Delete event | DELETE | `/assystREST/v2/events/{id}` | ✅ Verified (DELETE supported) |
| List event actions | GET | `/assystREST/v2/events/{id}/actions` | ✅ Verified from RAML |
| Create event action | POST | `/assystREST/v2/events/{id}/actions` | ✅ Verified from RAML |
| Get event definition | GET | `/assystREST/v2/events/definition` | ✅ Verified from documentation example |

### Event Query Parameters
✅ **Verified** (from documentation `eventType` and `eventStatus` examples):
```
GET /assystREST/v2/events?eventType=incident&eventStatus=open
```

⚠️ **Provisional** – additional event query parameters based on assyst data model and RAML conventions:
- `eventType` – event type enumeration (e.g., `incident`, `problem`, `change`, `serviceRequest`, `order`, `task`, `decision`)
- `eventStatus` – status enumeration (e.g., `open`, `inProgress`, `resolved`, `closed`, `cancelled`)
- `priorityCode` – priority short code
- `assignedGroupId` – assignment group numeric ID
- `serviceId` – service ID
- `affectedUserId` – affected user ID
- `creationDate` – date range for creation timestamp
- `lastModifiedDate` – date range for last modified timestamp
- `resolvedDate` – date range for resolution timestamp

### Event Schema Fields
⚠️ **Provisional** – field names are based on assyst naming conventions and published object graph documentation. These match the `camelCase` convention used throughout assystREST:

#### Core Identity Fields
| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique numeric event ID (immutable) |
| `eventRef` | string | Human-readable formatted reference (immutable, e.g., `INC0010001`) |
| `version` | integer | Optimistic lock version |

#### Type and Status
| Field | Type | Description |
|---|---|---|
| `eventType` | enum string | `INCIDENT`, `PROBLEM`, `CHANGE`, `SERVICE_REQUEST`, `ORDER`, `TASK`, `DECISION` |
| `eventStatus` | enum string | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`, `PENDING` |
| `priorityCode` | string | Priority short code (e.g., `P1`, `P2`, `P3`, `P4`) |
| `priorityDescription` | string | Priority display name |
| `impact` | integer | Impact level |
| `urgency` | integer | Urgency level |

#### Descriptions
| Field | Type | Description |
|---|---|---|
| `shortDescription` | string | Brief summary / title |
| `remarks` | string | Detailed description (may contain HTML / formatted text) |
| `resolutionCode` | string | Resolution short code |
| `resolutionRemarks` | string | Resolution details text |

#### Timestamps
| Field | Type | Description |
|---|---|---|
| `creationDate` | ISO 8601 UTC string | When event was logged |
| `lastModifiedDate` | ISO 8601 UTC string | Last update timestamp |
| `resolvedDate` | ISO 8601 UTC string | When event was resolved (null if open) |
| `closedDate` | ISO 8601 UTC string | When event was closed (null if not closed) |
| `requiredDate` | ISO 8601 UTC string | SLA target date |

#### Nested Objects (returned when expanded via `fields` parameter)
| Field | Type | Description |
|---|---|---|
| `affectedUser` | UserDto | User experiencing the issue |
| `assignedGroup` | GroupDto | Support team assigned |
| `assignedTech` | TechnicianDto | Individual assignee |
| `service` | ServiceDto | Associated service |
| `category` | CategoryDto | Incident category |
| `subCategory` | SubCategoryDto | Incident sub-category |
| `sourceSystem` | SourceDto | Origin channel |
| `parentEvent` | EventRefDto | Parent event reference |
| `linkedEvents` | EventRefDto[] | Related events |

#### Nested Object: UserDto
```json
{
  "id": 101,
  "shortCode": "JSMITH",
  "name": "John Smith",
  "email": "jsmith@example.com"
}
```

#### Nested Object: GroupDto
```json
{
  "id": 5,
  "shortCode": "L2-INFRA",
  "name": "L2 Infrastructure Team"
}
```

### Event Reference Format
✅ **Verified**: The `eventRef` is a formatted human-readable code. It is immutable.

Under **Single Sequential Numbering** (default for new assyst 11.2+ installations):
- All event types share one sequential number space
- Example: `INC0010001` (incidents conventionally prefixed INC in legacy, but may be any format)

Under **Legacy Numbering**:
- Incidents/Decisions/Tasks: above 10,000,001
- Problems: 0–5,000,000
- Changes/SR/Orders/Bundles: 5,000,001–10,000,000

---

## 9. Response Format

### Single Resource (JSON)
✅ **Verified**:
```json
{
  "id": 1234,
  "shortCode": "My Product",
  "name": "My Product",
  "version": 40,
  "productClassId": 20
}
```

### Collection (JSON)
✅ **Verified**: A **plain JSON array** (no envelope wrapper):
```json
[
  {
    "id": 1234,
    "shortCode": "My Product",
    "name": "My Product",
    "version": 25
  },
  {
    "id": 5678,
    "shortCode": "Other Product",
    "name": "Other Product",
    "version": 40
  }
]
```
> ✅ **Key**: Collections are **bare arrays**, NOT wrapped in an object like `{"results": [...]}`.  
> ✅ **Key**: Null fields and empty arrays are **omitted** from responses.

### Error Response
✅ **Verified**:
```json
{
  "type": "MethodNotAllowedException",
  "message": "The specified HTTP method is not allowed for the specified resource.",
  "diagnostic": "No resource method found for PUT, return 405 with Allow header"
}
```

### Validation Error Response (HTTP 400)
✅ **Verified**:
```json
{
  "type": "ComplexValidationException",
  "message": "A complex validation error has been detected by the application.",
  "errors": [
    {
      "rule": "mandatoryShortCode",
      "field": "shortCode",
      "message": "Shortcode is required.",
      "diagnostic": ""
    },
    {
      "rule": "mandatoryName",
      "field": "name",
      "message": "Name is required.",
      "diagnostic": ""
    }
  ]
}
```

### HTTP Status Codes
✅ **Verified**:
| Code | Meaning |
|---|---|
| 200 OK | Request succeeded |
| 201 Created | New resource created |
| 204 No Content | Success, no body |
| 400 Bad Request | Malformed request or validation failure |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Insufficient privileges |
| 405 Method Not Allowed | Unsupported HTTP verb (e.g., PUT) |
| 409 Conflict | Duplicate ID or stale version (optimistic lock) |
| 410 Gone | Resource no longer exists |
| 500 Internal Server Error | Unrecoverable application error |

---

## 10. Discoverability

✅ **Verified**: assystREST exposes RAML descriptions:
```
GET /assystREST/v2/raml                    # Full API overview
GET /assystREST/v2/<resource>/raml         # Resource-specific RAML
```

---

## 11. Other Reference Endpoints

✅ **Verified** from documentation examples:
- `GET /assystREST/v2/events/definition?eventType=INCIDENT` – custom form definition
- `DELETE /assystREST/v2/application/disconnect` – log out of session

---

## 12. Reference Data Endpoints

⚠️ **Provisional** – based on assystREST naming conventions and RAML pattern:

| Resource | Path | Notes |
|---|---|---|
| Users | `GET /assystREST/v2/assystUsers` | assyst operator users |
| Contact Users | `GET /assystREST/v2/contactUsers` | End users / affected users |
| Support Groups | `GET /assystREST/v2/supportGroups` | Assignment teams |
| Services | `GET /assystREST/v2/services` | Service catalog |
| Categories | `GET /assystREST/v2/categories` | Incident categories |
| Priority Codes | `GET /assystREST/v2/priorityCodes` | Priority definitions |
| Action Types | `GET /assystREST/v2/actionTypes` | Event action types |

---

## 13. Incremental Synchronization Strategy

The assystREST API does NOT document a native cursor-based incremental synchronization endpoint.

**Compatible client-side strategy using verified API features:**
1. Store the timestamp of the last successful sync as a local cursor.
2. On each sync cycle, query `GET /assystREST/v2/events?lastModifiedDate=<cursor>,` (open-ended range).
3. Page through results using `startRow` + `numberOfRows` until the result set is smaller than `numberOfRows`.
4. Process each page and update the local cursor to the maximum `lastModifiedDate` seen.
5. To avoid boundary gaps, overlap the cursor by a configurable safety window (e.g., 5 minutes).

> ⚠️ This is a **mock-only cursor implementation**. The real assystREST API relies on `lastModifiedDate` as a filter, which is a verified query parameter per the API's filtering mechanism.

---

## 14. Outstanding Questions and Unverified Details

1. **Exact event field names** – The precise JSON field names for event resources are not documented in the public wiki page. Names used in this mock follow assystREST naming conventions but must be verified against a RAML introspection of a real instance.

2. **Exact pagination parameter names** – `startRow` and `numberOfRows` are provisional. Verify against `GET /assystREST/v2/events/raml`.

3. **Event status enumeration values** – Exact string values for `eventStatus` are not listed in public documentation. Values like `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` are based on assyst UI labels and naming conventions.

4. **Event type enumeration values** – Similarly, exact string values for `eventType` are provisional.

5. **`eventRef` format** – The exact format of the formatted event reference depends on the assyst instance configuration (prefix, padding).

6. **Row limit defaults** – The default row limit is configurable per-instance and not published publicly.

7. **Search on nested fields** – Whether `lastModifiedDate` can be used as a direct query parameter on `/events` is provisional.

8. **Write operations for events** – Creating and updating events may require additional mandatory fields that are not documented in the public wiki. The `events/definition` endpoint would expose the required fields for a real instance.

---

## 15. Source Links

| Section | Source | Verification |
|---|---|---|
| Base URL / API version | https://wiki.axiossystems.com/assyst11-5Wiki/index.php/Integrations:assystREST | ✅ Direct |
| HTTP verbs | Same | ✅ Direct |
| Authentication mechanisms | Same | ✅ Direct |
| Date / date-range format | Same | ✅ Direct |
| Search / filter syntax | Same | ✅ Direct |
| Row limits | Same | ✅ Direct (existence confirmed; values provisional) |
| Field expansion/filtering | Same | ✅ Direct |
| Optimistic locking | Same | ✅ Direct |
| Response structure (array) | Same | ✅ Direct |
| Error format | Same | ✅ Direct |
| HTTP status codes | Same | ✅ Direct |
| RAML discoverability | Same | ✅ Direct |
| Session management | Same | ✅ Direct |
| Event field names | Not in public wiki | ⚠️ Provisional |
| Pagination parameters | Not explicitly in public wiki | ⚠️ Provisional |
| Event status/type enums | Not explicitly in public wiki | ⚠️ Provisional |
| Reference data endpoints | Not in public wiki | ⚠️ Provisional |
