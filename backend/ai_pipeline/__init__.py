"""
JANMITRA AI Pipeline Package.

Exposes the 4-layer civic defect intelligence and spatial deduplication system:
- Layer 1: EXIFChecker, ELAChecker, FakeDetector
- Layer 2: YOLOValidator
- Layer 3: DuplicateDetector, duplicate_check
- Layer 4: PriorityEngine, calculate_priority
- Master Runner: run_full_ai_pipeline
"""

from .pipeline import run_full_ai_pipeline
from .exif_checker import EXIFChecker
from .ela_checker import ELAChecker
from .fake_detector import FakeDetector
from .yolo_validator import YOLOValidator
from .duplicate_detector import DuplicateDetector, duplicate_check
from .priority_engine import PriorityEngine, calculate_priority, get_priority_level_and_sla

__version__ = "1.0.0"
__author__ = "Om S. Gadekar"

__all__ = [
    "run_full_ai_pipeline",
    "EXIFChecker",
    "ELAChecker",
    "FakeDetector",
    "YOLOValidator",
    "DuplicateDetector",
    "duplicate_check",
    "PriorityEngine",
    "calculate_priority",
    "get_priority_level_and_sla",
]
