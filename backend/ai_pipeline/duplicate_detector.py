"""
PostGIS & Geospatial Duplicate Complaint Detector Module.

Identifies redundant or duplicate civic complaints within a 100-meter radius using:
1. Production: GeoDjango PostGIS ST_DWithin spatial queries.
2. Development: Haversine distance mathematical fallback for SQLite / local testing.

When a duplicate is detected:
- Flags the current complaint as a duplicate linked to the parent complaint.
- Increments the parent complaint's duplicate_count by +1.
- Boosts the parent complaint's priority score by +15 points.
"""

import math
from typing import Dict, Any, Optional

# Attempt to import GeoDjango spatial measurement; fallback to mock for non-GIS environments
try:
    from django.contrib.gis.measure import D
except Exception:
    D = lambda m: m


# Active statuses eligible for duplicate matching
ACTIVE_STATUSES = ['Submitted', 'Validated', 'Routed', 'Assigned', 'In-Progress']


def haversine_distance(coord1, coord2) -> float:
    """
    Calculate the great circle distance in meters between two points on Earth
    using the Haversine formula.

    Supports:
    - GeoDjango GEOSGeometry Point instances (.y for lat, .x for lon)
    - Tuples or lists: (lat, lon) or (x, y)
    """
    def extract_lat_lon(c):
        if hasattr(c, 'y') and hasattr(c, 'x'):
            return float(c.y), float(c.x)
        if hasattr(c, 'coords') and len(c.coords) >= 2:
            return float(c.coords[1]), float(c.coords[0])
        if isinstance(c, (tuple, list)) and len(c) >= 2:
            return float(c[0]), float(c[1])
        return 0.0, 0.0

    lat1, lon1 = extract_lat_lon(coord1)
    lat2, lon2 = extract_lat_lon(coord2)

    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def duplicate_check(complaint) -> Dict[str, Any]:
    """
    Executes a geospatial 100-meter radius search to find existing duplicate complaints.

    Rules:
    - category == complaint.category
    - status in ['Submitted', 'Validated', 'Routed', 'Assigned', 'In-Progress']
    - ST_DWithin(location, complaint.location, D(m=100))
    - id != complaint.id (exclude self)

    If a duplicate match is found:
    - complaint.is_duplicate = True
    - complaint.parent_complaint = existing_complaint
    - existing_complaint.duplicate_count += 1
    - existing_complaint.priority_score += 15 (capped at 100)

    :param complaint: The incoming Complaint model instance.
    :return: Dict containing duplicate status, parent ID, count, and boosted priority.
    """
    result = {
        'is_duplicate': False,
        'parent_id': None,
        'duplicate_count': 0,
        'boosted_priority_score': getattr(complaint, 'priority_score', 0)
    }

    # Resolve QuerySet source (Django ORM or mock testing harness)
    queryset = None
    if hasattr(complaint, '_mock_queryset') and complaint._mock_queryset is not None:
        queryset = complaint._mock_queryset
    else:
        try:
            from complaints.models import Complaint
            queryset = getattr(Complaint, 'objects', None)
        except ImportError:
            queryset = None

    if queryset is None:
        return result

    existing_complaint = None

    # 1. Primary: GeoDjango PostGIS Spatial Query (ST_DWithin)
    try:
        spatial_query = queryset.filter(
            category=complaint.category,
            status__in=ACTIVE_STATUSES,
            location__distance_lte=(complaint.location, D(m=100))
        ).exclude(id=complaint.id)

        # Order by creation date if attribute exists to find the earliest parent
        if hasattr(complaint, 'created_at'):
            spatial_query = spatial_query.order_by('created_at')

        if spatial_query.count() > 0:
            existing_complaint = spatial_query.first()

    except Exception as spatial_err:
        # 2. Secondary Fallback: SQLite Development Mode (Haversine calculation)
        # Triggered when SQLite is used without the SpatiaLite extension
        try:
            candidates = queryset.filter(
                category=complaint.category,
                status__in=ACTIVE_STATUSES
            ).exclude(id=complaint.id)

            for cand in candidates:
                cand_loc = getattr(cand, 'location', None)
                if cand_loc is not None and complaint.location is not None:
                    dist = haversine_distance(complaint.location, cand_loc)
                    if dist <= 100.0:
                        existing_complaint = cand
                        break

        except Exception as sqlite_err:
            print(f"[DuplicateDetector] SQLite fallback query error: {sqlite_err}")

    # 3. Apply Duplicate Resolution Rules if Match is Found
    if existing_complaint is not None:
        # A. Flag incoming complaint as a duplicate
        complaint.is_duplicate = True
        complaint.parent_complaint = existing_complaint
        if hasattr(complaint, 'save'):
            complaint.save()

        # B. Increment parent complaint's duplicate count by 1
        current_dups = getattr(existing_complaint, 'duplicate_count', 0) or 0
        existing_complaint.duplicate_count = current_dups + 1

        # C. Boost parent complaint priority score by +15 points (capped at 100)
        current_score = getattr(existing_complaint, 'priority_score', 0.0) or 0.0
        boosted_score = min(float(current_score) + 15.0, 100.0)
        existing_complaint.priority_score = round(boosted_score, 2)

        # D. Update priority level tier if present
        if hasattr(existing_complaint, 'priority_level'):
            if boosted_score <= 30.0:
                existing_complaint.priority_level = 'Low'
            elif boosted_score <= 60.0:
                existing_complaint.priority_level = 'Medium'
            elif boosted_score <= 80.0:
                existing_complaint.priority_level = 'High'
            else:
                existing_complaint.priority_level = 'Critical'

        if hasattr(existing_complaint, 'save'):
            existing_complaint.save()

        result['is_duplicate'] = True
        result['parent_id'] = getattr(existing_complaint, 'id', None)
        result['duplicate_count'] = existing_complaint.duplicate_count
        result['boosted_priority_score'] = existing_complaint.priority_score

    return result


class DuplicateDetector:
    """
    Object-oriented wrapper class providing backward compatibility
    for existing pipeline tasks and test suites.
    """

    def detect(self, complaint) -> Dict[str, Any]:
        """Wrapper method for duplicate_check."""
        return duplicate_check(complaint)

    def duplicate_check(self, complaint) -> Dict[str, Any]:
        """Direct alias for duplicate_check function."""
        return duplicate_check(complaint)
