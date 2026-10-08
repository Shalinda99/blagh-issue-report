"""
Report enumerations — shared across the service and endpoint layers.
MongoDB document shape is defined implicitly by the service layer.
"""

from enum import Enum


class ReportStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    DUPLICATE = "duplicate"


class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"
