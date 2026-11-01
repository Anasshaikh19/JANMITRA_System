"""
JANMITRA Unified AI Pipeline Runner.

Provides a single master function `run_full_ai_pipeline` that executes the complete
4-stage automated verification cascade on an incoming civic grievance:
1. Layer 1: Forensic Integrity & Anti-Spoofing Filter (EXIF, ELA, ViT)
2. Layer 2: YOLOv8 Civic Object Detection & Relevance Validation
3. Layer 3: PostGIS 100m Geodesic Duplicate Detection
4. Layer 4: Multi-Criteria Priority Scoring & SLA Mapping

Designed for clean, 3-line integration into Django views or Celery workers.
"""

import os
import time
import logging
from typing import Dict, Any, Optional

from .exif_checker import EXIFChecker
from .ela_checker import ELAChecker
from .fake_detector import FakeDetector
from .yolo_validator import YOLOValidator
from .duplicate_detector import duplicate_check, haversine_distance
from .priority_engine import calculate_priority, get_priority_level_and_sla

logger = logging.getLogger("ai_pipeline")


def run_full_ai_pipeline(
    photo_path: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    category: str = "pothole",
    description: str = "",
    complaint_id: Optional[Any] = None,
    complaint_instance: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Executes the full 4-layer AI & Spatial verification pipeline on a complaint.

    :param photo_path: Path to the citizen's uploaded image.
    :param latitude: GPS latitude of the complaint.
    :param longitude: GPS longitude of the complaint.
    :param category: One of ['pothole', 'garbage', 'water leak', 'streetlight'].
    :param description: Optional citizen complaint description text.
    :param complaint_id: Optional database primary key or complaint tracking ID.
    :param complaint_instance: Optional Django Complaint model instance.
    :return: Dict containing validated status, confidence, duplicates, priority score, and citizen message.
    """
    t_start = time.perf_counter()

    result = {
        "complaint_id": complaint_id,
        "status": "Pending Validation",
        "category": category,
        "is_valid": False,
        "is_fake": False,
        "is_duplicate": False,
        "parent_complaint_id": None,
        "ai_confidence": 0.0,
        "detected_tags": [],
        "rejection_reason": "",
        "citizen_message": "",
        "priority_score": 50,
        "priority_level": "Medium",
        "target_sla": "72h",
        "stage_timings_ms": {},
        "total_execution_time_ms": 0.0,
    }

    # --------------------------------------------------------------------------
    # Guard: Image path existence
    # --------------------------------------------------------------------------
    if not photo_path or not os.path.exists(photo_path):
        result["status"] = "Pending Validation"
        result["rejection_reason"] = "Image file missing or path invalid"
        result["citizen_message"] = "The photo could not be located on the server. Please re-upload."
        result["total_execution_time_ms"] = round((time.perf_counter() - t_start) * 1000.0, 2)
        return result

    # --------------------------------------------------------------------------
    # Layer 1: Forensic Integrity & Anti-Spoofing Filter
    # --------------------------------------------------------------------------
    t0 = time.perf_counter()
    exif = EXIFChecker().check(photo_path)
    result["stage_timings_ms"]["exif_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    t0 = time.perf_counter()
    ela = ELAChecker().check(photo_path)
    result["stage_timings_ms"]["ela_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    t0 = time.perf_counter()
    fake = FakeDetector().predict(photo_path)
    result["stage_timings_ms"]["vit_fake_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    # Check for hard fake detection (Vision Transformer synthetic prob >= 0.70)
    if fake.get("is_fake", False) and fake.get("confidence", 0.0) >= 0.70:
        result["status"] = "Rejected"
        result["is_fake"] = True
        result["rejection_reason"] = f"AI detected synthetic/manipulated image: {fake.get('reason', 'High artificial probability')}"
        result["citizen_message"] = "The uploaded photograph was flagged as artificially generated or digitally altered. Please upload an authentic photo taken at the civic issue site."
        result["total_execution_time_ms"] = round((time.perf_counter() - t_start) * 1000.0, 2)
        return result

    # Check for unreadable/corrupted files
    if not ela.get("format_valid", True):
        result["status"] = "Pending Validation"
        result["rejection_reason"] = f"Image compression error: {ela.get('reason', 'Corrupt format')}"
        result["citizen_message"] = ela.get("citizen_message", "Image file appears unreadable; routed for manual review.")
        result["total_execution_time_ms"] = round((time.perf_counter() - t_start) * 1000.0, 2)
        return result

    # --------------------------------------------------------------------------
    # Layer 2: YOLOv8 Civic Object Detection
    # --------------------------------------------------------------------------
    t0 = time.perf_counter()
    yolo_validator = YOLOValidator()
    yolo_res = yolo_validator.validate(photo_path, expected_category=category)
    result["stage_timings_ms"]["yolo_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    result["ai_confidence"] = yolo_res.get("confidence", 0.85)
    result["detected_tags"] = yolo_res.get("detected_tags", [category])

    if yolo_res.get("valid", False):
        result["status"] = "Validated"
        result["is_valid"] = True
    else:
        # Category mismatch or low confidence -> Soft Failure to human queue
        result["status"] = "Pending Validation"
        result["is_valid"] = False
        result["rejection_reason"] = yolo_res.get("reason", "Low detection confidence; routed to manual officer review queue")

    # --------------------------------------------------------------------------
    # Layer 3: Geospatial 100m Duplicate Detection (PostGIS / Haversine)
    # --------------------------------------------------------------------------
    t0 = time.perf_counter()
    if complaint_instance:
        dup_res = duplicate_check(complaint_instance)
    else:
        # Construct lightweight mock object if no Django ORM instance provided
        class MockComplaint:
            def __init__(self, cid, cat, lat, lon):
                self.id = cid
                self.category = cat
                self.location = (lat, lon) if (lat is not None and lon is not None) else None
                self.latitude = lat
                self.longitude = lon
                self.priority_score = 50
                self.duplicate_count = 0
                self._mock_queryset = None

        mock_obj = MockComplaint(complaint_id, category, latitude, longitude)
        dup_res = duplicate_check(mock_obj)

    result["stage_timings_ms"]["spatial_dup_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    result["is_duplicate"] = dup_res.get("is_duplicate", False)
    result["parent_complaint_id"] = dup_res.get("parent_id", None)
    dup_count = dup_res.get("duplicate_count", 0)

    # --------------------------------------------------------------------------
    # Layer 4: AHP Priority Scoring Engine
    # --------------------------------------------------------------------------
    t0 = time.perf_counter()
    priority_data = {
        "category": category,
        "description": description,
        "duplicate_count": dup_count + (1 if result["is_duplicate"] else 0),
        "ai_confidence": result["ai_confidence"],
        "status": result["status"]
    }
    priority_res = calculate_priority(priority_data)
    result["stage_timings_ms"]["priority_ms"] = round((time.perf_counter() - t0) * 1000.0, 2)

    result["priority_score"] = priority_res.get("score", 50)
    result["priority_level"] = priority_res.get("level", "Medium")
    result["target_sla"] = priority_res.get("target_sla", "72h")

    # --------------------------------------------------------------------------
    # Total Execution Timing & Finalization
    # --------------------------------------------------------------------------
    result["total_execution_time_ms"] = round((time.perf_counter() - t_start) * 1000.0, 2)
    return result
