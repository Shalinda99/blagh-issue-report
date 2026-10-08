"""
Seed data generator.  Produces realistic assyst incidents including
duplicate, similar, and unrelated scenarios for the Similarity Check Index.
All generated data is for mock/testing purposes only.
"""
from __future__ import annotations
import random
from datetime import datetime, timezone, timedelta
from typing import Any

from app.database.repositories import (
    EventRepository, UserRepository,
    TeamRepository, CategoryRepository, ServiceRepository,
)
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

TEAMS = [
    {"id": 1, "shortCode": "L1-SD",     "name": "L1 Service Desk",           "version": 1},
    {"id": 2, "shortCode": "L2-INFRA",  "name": "L2 Infrastructure",         "version": 1},
    {"id": 3, "shortCode": "L2-APP",    "name": "L2 Application Support",     "version": 1},
    {"id": 4, "shortCode": "L2-NET",    "name": "L2 Network Operations",      "version": 1},
    {"id": 5, "shortCode": "L3-DBA",    "name": "L3 Database Administration", "version": 1},
    {"id": 6, "shortCode": "L3-SEC",    "name": "L3 Security Operations",     "version": 1},
    {"id": 7, "shortCode": "L3-DEV",    "name": "L3 Development",             "version": 1},
    {"id": 8, "shortCode": "L3-CLOUD",  "name": "L3 Cloud Operations",        "version": 1},
]

USERS = [
    {"id": 101, "shortCode": "JSMITH",   "name": "John Smith",       "email": "jsmith@example.com",   "version": 1},
    {"id": 102, "shortCode": "MLEE",     "name": "Michelle Lee",     "email": "mlee@example.com",     "version": 1},
    {"id": 103, "shortCode": "DPATEL",   "name": "Dev Patel",        "email": "dpatel@example.com",   "version": 1},
    {"id": 104, "shortCode": "SJONES",   "name": "Sarah Jones",      "email": "sjones@example.com",   "version": 1},
    {"id": 105, "shortCode": "RCHANG",   "name": "Ray Chang",        "email": "rchang@example.com",   "version": 1},
    {"id": 106, "shortCode": "LGARCIA",  "name": "Luis Garcia",      "email": "lgarcia@example.com",  "version": 1},
    {"id": 107, "shortCode": "AKIM",     "name": "Alex Kim",         "email": "akim@example.com",     "version": 1},
    {"id": 108, "shortCode": "TNGUYEN",  "name": "Tina Nguyen",      "email": "tnguyen@example.com",  "version": 1},
    {"id": 109, "shortCode": "BWILSON",  "name": "Brian Wilson",     "email": "bwilson@example.com",  "version": 1},
    {"id": 110, "shortCode": "CMARTINEZ","name": "Carmen Martinez",  "email": "cmartinez@example.com","version": 1},
    {"id": 111, "shortCode": "FMÜLLER",  "name": "Franz Müller",     "email": "fmuller@example.com",  "version": 1},
    {"id": 112, "shortCode": "YCHEN",    "name": "Yuki Chen",        "email": "ychen@example.com",    "version": 1},
]

CATEGORIES = [
    {"id": 201, "shortCode": "ACCESS",   "name": "Access & Authentication",  "version": 1, "subCategories": [
        {"id": 2011, "shortCode": "LOGIN",  "name": "Login Failure"},
        {"id": 2012, "shortCode": "SSO",    "name": "SSO Issues"},
        {"id": 2013, "shortCode": "MFA",    "name": "MFA Problems"},
    ]},
    {"id": 202, "shortCode": "DATABASE",  "name": "Database",                "version": 1, "subCategories": [
        {"id": 2021, "shortCode": "CONN",   "name": "Connection Failure"},
        {"id": 2022, "shortCode": "PERF",   "name": "Performance Degradation"},
        {"id": 2023, "shortCode": "CORRUPT","name": "Data Corruption"},
    ]},
    {"id": 203, "shortCode": "NETWORK",   "name": "Network & Connectivity",  "version": 1, "subCategories": [
        {"id": 2031, "shortCode": "DNS",    "name": "DNS Resolution"},
        {"id": 2032, "shortCode": "LATENCY","name": "High Latency"},
        {"id": 2033, "shortCode": "OUTAGE", "name": "Network Outage"},
    ]},
    {"id": 204, "shortCode": "APP",       "name": "Application",             "version": 1, "subCategories": [
        {"id": 2041, "shortCode": "CRASH",  "name": "Application Crash"},
        {"id": 2042, "shortCode": "TIMEOUT","name": "API Timeout"},
        {"id": 2043, "shortCode": "UI",     "name": "UI / Frontend Defect"},
    ]},
    {"id": 205, "shortCode": "INFRA",     "name": "Infrastructure",          "version": 1, "subCategories": [
        {"id": 2051, "shortCode": "SERVER", "name": "Server Outage"},
        {"id": 2052, "shortCode": "DISK",   "name": "Disk / Storage Issue"},
        {"id": 2053, "shortCode": "CERT",   "name": "Certificate Expiry"},
    ]},
    {"id": 206, "shortCode": "DEPLOY",    "name": "Deployment",              "version": 1, "subCategories": [
        {"id": 2061, "shortCode": "FAIL",   "name": "Deployment Failure"},
        {"id": 2062, "shortCode": "ROLLBACK","name": "Rollback Required"},
    ]},
    {"id": 207, "shortCode": "SECURITY",  "name": "Security",                "version": 1, "subCategories": [
        {"id": 2071, "shortCode": "BREACH", "name": "Security Breach"},
        {"id": 2072, "shortCode": "PERMS",  "name": "Permission Error"},
    ]},
    {"id": 208, "shortCode": "DATA",      "name": "Data & Integration",      "version": 1, "subCategories": [
        {"id": 2081, "shortCode": "SYNC",   "name": "Data Sync Error"},
        {"id": 2082, "shortCode": "EXPORT", "name": "Export / Report Error"},
    ]},
    {"id": 209, "shortCode": "OTHER",     "name": "Other / General",         "version": 1, "subCategories": [
        {"id": 2091, "shortCode": "GEN",    "name": "General Request"},
    ]},
]

SERVICES = [
    {"id": 301, "shortCode": "EMP-PORTAL","name": "Employee Portal",         "version": 1},
    {"id": 302, "shortCode": "HR-SYS",    "name": "HR System",               "version": 1},
    {"id": 303, "shortCode": "CRM",       "name": "CRM Platform",            "version": 1},
    {"id": 304, "shortCode": "ERP",       "name": "ERP System",              "version": 1},
    {"id": 305, "shortCode": "EMAIL",     "name": "Email & Collaboration",   "version": 1},
    {"id": 306, "shortCode": "VPN",       "name": "VPN & Remote Access",     "version": 1},
    {"id": 307, "shortCode": "DB-PROD",   "name": "Production Database",     "version": 1},
    {"id": 308, "shortCode": "API-GW",    "name": "API Gateway",             "version": 1},
    {"id": 309, "shortCode": "CLOUD-INF", "name": "Cloud Infrastructure",    "version": 1},
    {"id": 310, "shortCode": "CI-CD",     "name": "CI/CD Pipeline",          "version": 1},
]

PRIORITIES = [
    ("P1", "Critical", 1, 1),
    ("P2", "High",     2, 2),
    ("P3", "Medium",   3, 3),
    ("P4", "Low",      4, 4),
]

STATUSES = ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]

# ---------------------------------------------------------------------------
# Similarity test scenarios — specific incident clusters
# ---------------------------------------------------------------------------

SIMILARITY_CLUSTERS = [
    # Cluster 1: Employee portal login failure (exact/semantic duplicates)
    {
        "category_id": 201, "subcategory_id": 2011, "service_id": 301,
        "priority": "P2",
        "incidents": [
            ("Unable to log into the employee portal",
             "I cannot access the employee portal. The login page accepts my credentials but immediately redirects me back to the login screen without granting access."),
            ("Employee portal login not working",
             "The employee portal is refusing my login. I enter the correct username and password but it does not let me in and shows no error message."),
            ("Cannot sign in to staff portal",
             "The employee portal rejects valid user credentials. I have tried resetting my password but the issue persists. The portal does not display an error."),
            ("Login fails on the staff dashboard after entering the correct password",
             "After entering my password on the staff dashboard login page, the system processes for a few seconds then returns me to the login screen. No error is shown."),
            ("Staff portal authentication broken",
             "Multiple users in our department are unable to log into the staff dashboard. The authentication appears to be failing silently with no error displayed."),
        ],
    },
    # Cluster 2: Database connection failure (semantic duplicates)
    {
        "category_id": 202, "subcategory_id": 2021, "service_id": 307,
        "priority": "P1",
        "incidents": [
            ("Production database connection refused",
             "The application is throwing 'connection refused' errors when attempting to connect to the production PostgreSQL database. All services depending on the DB are affected."),
            ("Cannot connect to production database",
             "Services are reporting database connection failures. The database server appears to be running but connections are being refused. Started approximately 30 minutes ago."),
            ("Database is unreachable from application servers",
             "Our application servers cannot establish a connection to the production database. Telnet to port 5432 times out. The database host responds to pings."),
            ("DB connection pool exhausted",
             "The production database connection pool is exhausted. New connection requests are timing out. The database server is running but not accepting new connections."),
        ],
    },
    # Cluster 3: API timeout (partial matches)
    {
        "category_id": 204, "subcategory_id": 2042, "service_id": 308,
        "priority": "P2",
        "incidents": [
            ("API gateway returning 504 timeout errors",
             "The API gateway is returning HTTP 504 Gateway Timeout errors for requests to the payment processing microservice. This is affecting checkout functionality."),
            ("Payment service API calls timing out",
             "Calls to the payment processing API are timing out after 30 seconds. The issue started after the deployment at 14:00. Rolling back is being considered."),
            ("Intermittent timeouts on customer-facing API",
             "The customer-facing API is experiencing intermittent timeouts. Approximately 15% of requests are failing. The issue appears to be load-related."),
        ],
    },
    # Cluster 4: Unrelated incidents (should NOT match)
    {
        "category_id": 208, "subcategory_id": 2082, "service_id": 302,
        "priority": "P3",
        "incidents": [
            ("Monthly payroll export produces incorrect CSV format",
             "The monthly payroll export is generating a CSV file with incorrect column formatting. The date fields are not in the expected format and amounts are missing decimal places."),
            ("Quarterly report missing data for Q3",
             "The quarterly financial report is missing data for the months of July and August. The report appears to have only captured September data."),
        ],
    },
    # Cluster 5: Deployment failure
    {
        "category_id": 206, "subcategory_id": 2061, "service_id": 310,
        "priority": "P1",
        "incidents": [
            ("Production deployment failed — service unavailable",
             "The deployment of version 2.4.1 to production has failed. The service is currently unavailable. The deployment pipeline stopped at the health check stage."),
            ("CI/CD pipeline deployment stuck at health check",
             "The CI/CD pipeline for the latest release has been stuck at the health check step for 45 minutes. The deployment is blocking other releases."),
            ("Blue-green deployment rollback required",
             "The blue-green deployment for the billing service has failed during the traffic switch. Rollback to the previous version has been initiated automatically."),
        ],
    },
    # Cluster 6: Security / permission
    {
        "category_id": 207, "subcategory_id": 2072, "service_id": 303,
        "priority": "P2",
        "incidents": [
            ("User unable to access CRM reports — permission denied",
             "A user is receiving 403 Forbidden errors when attempting to access CRM reports. The user's role was changed last week and access may not have been correctly updated."),
            ("CRM read access not working after role change",
             "After a role change in the CRM system, the affected user can no longer view customer reports. The permission update appears to have not taken effect."),
        ],
    },
    # Cluster 7: Network outage
    {
        "category_id": 203, "subcategory_id": 2033, "service_id": 306,
        "priority": "P1",
        "incidents": [
            ("VPN network outage affecting remote workers",
             "The VPN service is down for all remote workers. Users are unable to connect and are receiving connection timeout errors. The issue affects the entire remote workforce."),
            ("Remote access VPN unreachable",
             "The corporate VPN endpoint is not responding. Remote employees cannot connect. The issue started at approximately 09:15 UTC."),
        ],
    },
]

# Additional diverse incidents for variety
GENERAL_INCIDENTS = [
    (204, 2043, 305, "P3", "Email client crashes when opening attachments",
     "Microsoft Outlook is crashing when users attempt to open PDF attachments. The issue occurs reproducibly on Windows 10 machines with Outlook version 2303."),
    (205, 2051, 309, "P1", "Cloud server instance unresponsive",
     "A production EC2 instance has become unresponsive. SSH connections time out and the application it hosts is returning 503 errors. AWS console shows the instance as running."),
    (205, 2052, 309, "P2", "Low disk space on application server",
     "The primary application server is reporting critically low disk space (less than 2% free). Log files are consuming most of the available space."),
    (201, 2012, 305, "P2", "SSO not working after Active Directory update",
     "Following a scheduled Active Directory update, Single Sign-On is no longer functioning for Office 365. Users are prompted for credentials repeatedly."),
    (202, 2022, 307, "P2", "Slow database query performance on reports",
     "Database queries for the reporting module are taking over 5 minutes to complete. Normal operations are not affected, but report generation is unusable."),
    (208, 2081, 304, "P2", "ERP data synchronization failing overnight",
     "The nightly ERP data synchronization job failed to complete. Integration logs show a timeout error when connecting to the legacy system endpoint."),
    (204, 2041, 303, "P1", "CRM application crashes on login for all users",
     "The CRM application is crashing immediately after login for all users. The error log shows a NullPointerException in the session initialization code."),
    (203, 2031, 309, "P3", "DNS resolution failures for internal services",
     "Internal service DNS lookups are intermittently failing. Some services cannot resolve each other by hostname. External DNS appears to be working correctly."),
    (205, 2053, 309, "P1", "SSL certificate expired on payment gateway",
     "The SSL certificate for the payment gateway has expired, causing all payment transactions to fail with a certificate error. Emergency renewal required."),
    (206, 2062, 310, "P2", "Hotfix rollback required after failed patch",
     "A security hotfix deployed this morning has caused intermittent 500 errors in the customer portal. A rollback to the previous version has been requested."),
    (207, 2071, 309, "P1", "Suspicious login activity detected from unknown IP",
     "Security monitoring has detected multiple failed login attempts followed by a successful login from an IP address in an unusual geographic location."),
    (201, 2013, 301, "P2", "MFA tokens not being received via SMS",
     "Users are not receiving SMS-based MFA tokens. The authentication service is reporting errors from the SMS gateway provider."),
    (204, 2042, 304, "P3", "ERP system API slow response during batch processing",
     "The ERP API is responding slowly during the daily batch processing window. Response times have increased from under 1 second to over 30 seconds."),
    (208, 2082, 302, "P3", "HR export missing employee records for new starters",
     "The HR system export is not including employees who joined in the last 30 days. This is causing issues with onboarding process automation."),
    (203, 2032, 306, "P3", "High network latency between data centers",
     "Network latency between the primary and secondary data centers has increased significantly. Replication lag is affecting backup integrity."),
    (202, 2023, 307, "P1", "Data corruption detected in customer records table",
     "Data corruption has been detected in the customer records table. Several hundred records have incorrect values in the address fields."),
    (204, 2041, 301, "P2", "Employee portal session timeout too aggressive",
     "Users are being logged out of the employee portal after only 5 minutes of inactivity. The expected session timeout is 30 minutes."),
    (206, 2061, 308, "P2", "API deployment breaking backward compatibility",
     "A new version of the payment API has been deployed without a version bump, breaking integrations with partner systems that depend on the previous response format."),
    (207, 2072, 304, "P3", "Incorrect user permissions after role migration",
     "Following the role migration project, approximately 50 users have incorrect permissions assigned. Some users have more access than required."),
    (205, 2051, 309, "P2", "Memory exhaustion on web server cluster",
     "The web server cluster is experiencing memory exhaustion. Average memory usage is at 95% and the JVM garbage collector is running continuously."),
]


def _ts_ago(days: int = 0, hours: int = 0, minutes: int = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days, hours=hours, minutes=minutes)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _random_ts(days_back_min: int, days_back_max: int) -> str:
    days = random.uniform(days_back_min, days_back_max)
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _priority_label(code: str) -> str:
    return {"P1": "Critical", "P2": "High", "P3": "Medium", "P4": "Low"}.get(code, code)


def _build_nested(doc: dict) -> dict:
    """Attach denormalized nested objects for field expansion support."""
    user = next((u for u in USERS if u["id"] == doc.get("affectedUserId")), None)
    team = next((t for t in TEAMS if t["id"] == doc.get("assignedGroupId")), None)
    cat = next((c for c in CATEGORIES if c["id"] == doc.get("categoryId")), None)
    svc = next((s for s in SERVICES if s["id"] == doc.get("serviceId")), None)

    if user:
        doc["affectedUser"] = {"id": user["id"], "shortCode": user["shortCode"],
                                "name": user["name"], "email": user["email"]}
    if team:
        doc["assignedGroup"] = {"id": team["id"], "shortCode": team["shortCode"],
                                 "name": team["name"]}
    if cat:
        doc["category"] = {"id": cat["id"], "shortCode": cat["shortCode"],
                            "name": cat["name"]}
        subcats = cat.get("subCategories", [])
        sub_id = doc.get("subCategoryId")
        sub = next((s for s in subcats if s["id"] == sub_id), None)
        if sub:
            doc["subCategory"] = {"id": sub["id"], "shortCode": sub["shortCode"],
                                   "name": sub["name"]}
    if svc:
        doc["service"] = {"id": svc["id"], "shortCode": svc["shortCode"],
                           "name": svc["name"]}
    return doc


def _make_event(
    event_id: int,
    short_desc: str,
    remarks: str,
    category_id: int,
    subcategory_id: int,
    service_id: int,
    priority: str,
    status: str,
    days_back_min: int,
    days_back_max: int,
    version: int = 1,
) -> dict:
    creation = _random_ts(days_back_min, days_back_max)
    modified = creation

    resolved_date = None
    closed_date = None
    resolution_remarks = None

    if status in ("RESOLVED", "CLOSED"):
        resolved_after = random.uniform(0.5, 24)
        resolved_dt = datetime.strptime(creation, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) + timedelta(hours=resolved_after)
        resolved_date = resolved_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        modified = resolved_date
        resolution_remarks = random.choice([
            "Issue resolved by restarting the affected service.",
            "Root cause identified and configuration corrected.",
            "Vendor patch applied successfully.",
            "Temporary workaround implemented pending permanent fix.",
            "Network configuration restored to last known good state.",
            "Database connection pool settings updated and service restarted.",
            "Certificate renewed and service restarted.",
        ])
        if status == "CLOSED":
            closed_dt = resolved_dt + timedelta(hours=random.uniform(1, 48))
            closed_date = closed_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            modified = closed_date

    user = random.choice(USERS)
    team = random.choice(TEAMS)

    doc: dict[str, Any] = {
        "id": event_id,
        "version": version,
        "eventRef": f"INC{event_id:010d}",
        "eventType": "INCIDENT",
        "eventStatus": status,
        "shortDescription": short_desc,
        "remarks": remarks,
        "priorityCode": priority,
        "priorityDescription": _priority_label(priority),
        "impact": {"P1": 1, "P2": 2, "P3": 3, "P4": 4}.get(priority, 3),
        "urgency": {"P1": 1, "P2": 2, "P3": 3, "P4": 4}.get(priority, 3),
        "creationDate": creation,
        "lastModifiedDate": modified,
        "affectedUserId": user["id"],
        "assignedGroupId": team["id"],
        "assignedTechId": user["id"],
        "serviceId": service_id,
        "categoryId": category_id,
        "subCategoryId": subcategory_id,
    }
    if resolved_date:
        doc["resolvedDate"] = resolved_date
        doc["resolutionRemarks"] = resolution_remarks
    if closed_date:
        doc["closedDate"] = closed_date

    return _build_nested(doc)


class SeedService:
    def __init__(
        self,
        event_repo: EventRepository,
        user_repo: UserRepository,
        team_repo: TeamRepository,
        category_repo: CategoryRepository,
        service_repo: ServiceRepository,
    ):
        self._events = event_repo
        self._users = user_repo
        self._teams = team_repo
        self._categories = category_repo
        self._services = service_repo

    async def is_seeded(self) -> bool:
        return await self._events.count_all() > 0

    async def seed_reference_data(self) -> None:
        for u in USERS:
            await self._users.upsert(u.copy())
        for t in TEAMS:
            await self._teams.upsert(t.copy())
        for c in CATEGORIES:
            await self._categories.upsert(c.copy())
        for s in SERVICES:
            await self._services.upsert(s.copy())
        logger.info("Reference data seeded: %d users, %d teams, %d categories, %d services",
                    len(USERS), len(TEAMS), len(CATEGORIES), len(SERVICES))

    async def seed_events(self, count: int = 100) -> int:
        event_id = 10000001
        docs: list[dict] = []

        # 1. Similarity cluster incidents (forced scenarios)
        status_pool_open = ["OPEN", "IN_PROGRESS", "PENDING"]
        status_pool_hist = ["RESOLVED", "CLOSED"]

        for cluster in SIMILARITY_CLUSTERS:
            for i, (short_desc, remarks) in enumerate(cluster["incidents"]):
                days_back = random.randint(1, 180)
                s = status_pool_open[i % len(status_pool_open)] if i < 2 else random.choice(status_pool_hist)
                docs.append(_make_event(
                    event_id, short_desc, remarks,
                    cluster["category_id"], cluster["subcategory_id"], cluster["service_id"],
                    cluster["priority"], s,
                    days_back_min=0, days_back_max=days_back,
                ))
                event_id += 1

        # 2. General incidents
        for (cat_id, sub_id, svc_id, prio, short, rem) in GENERAL_INCIDENTS:
            days_back = random.randint(1, 365)
            s = random.choice(STATUSES)
            docs.append(_make_event(
                event_id, short, rem, cat_id, sub_id, svc_id, prio, s,
                days_back_min=0, days_back_max=days_back,
            ))
            event_id += 1

        # 3. Fill remainder up to `count` with generated incidents
        remaining = count - len(docs)
        if remaining > 0:
            docs.extend(self._generate_bulk(event_id, remaining))

        # Upsert all (idempotent)
        inserted = 0
        for doc in docs:
            await self._events.upsert(doc["id"], doc)
            inserted += 1

        logger.info("Seeded %d events", inserted)
        return inserted

    def _generate_bulk(self, start_id: int, count: int) -> list[dict]:
        templates = [
            (209, 2091, 305, "P3",
             "User unable to access shared network drive",
             "A user is unable to map or access the shared network drive. The drive letter is not appearing in Windows Explorer and net use commands fail."),
            (201, 2011, 301, "P3",
             "Password reset not completing successfully",
             "The self-service password reset portal is not completing successfully. Users receive a confirmation email but the new password is not accepted on login."),
            (204, 2043, 303, "P4",
             "CRM dashboard displays incorrect currency symbols",
             "The CRM dashboard is showing incorrect currency symbols for international accounts. USD amounts are displayed as EUR in several report widgets."),
            (203, 2032, 306, "P3",
             "Slow VPN connection for users in remote offices",
             "Users connecting from remote offices are experiencing significantly slower VPN speeds compared to the main office. Throughput is less than 5 Mbps."),
            (205, 2052, 309, "P2",
             "Backup job failing — storage quota exceeded",
             "The nightly backup job is failing because the backup storage quota has been exceeded. Older backups need to be archived or deleted."),
            (208, 2081, 304, "P2",
             "Customer data not syncing between CRM and ERP",
             "Customer records updated in the CRM are not being reflected in the ERP system. The integration sync job appears to be completing without errors."),
            (206, 2061, 310, "P2",
             "Automated test suite failing in CI pipeline",
             "The automated regression test suite is failing in the CI pipeline. 23 tests are failing due to a change in the authentication module."),
            (207, 2072, 308, "P3",
             "API rate limit exceeded by integration partner",
             "An integration partner is exceeding the API rate limit, causing throttling responses. This is affecting their ability to sync data."),
            (202, 2021, 307, "P2",
             "Read replicas falling behind primary database",
             "The read replica databases are falling significantly behind the primary. Replication lag has reached 45 minutes, affecting reporting accuracy."),
            (204, 2042, 308, "P2",
             "Third-party payment gateway returning errors",
             "The third-party payment gateway is returning errors for approximately 8% of transactions. Error code 503 indicates service unavailability on their side."),
        ]

        docs = []
        for i in range(count):
            t = templates[i % len(templates)]
            cat_id, sub_id, svc_id, prio, short, rem = t
            days_back = random.randint(1, 365)
            s = random.choice(STATUSES)
            docs.append(_make_event(
                start_id + i, short, rem, cat_id, sub_id, svc_id, prio, s,
                days_back_min=0, days_back_max=days_back,
            ))
        return docs

    async def reset(self) -> None:
        """Drop all collections and re-seed. For development use only."""
        from app.database.mongo import get_db
        db = get_db()
        for col in ["events", "users", "teams", "categories", "services"]:
            await db[col].drop()
        logger.info("All collections dropped")
        await self.seed_reference_data()
        await self.seed_events(settings.SEED_DATA_COUNT)
