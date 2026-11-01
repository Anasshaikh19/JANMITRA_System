"""
Quick Integration Smoke Test for JANMITRA AI Pipeline.
Run this script to verify that all 4 layers of the AI pipeline are operating correctly.

Usage:
    python test_ai_pipeline.py
"""

import os
import sys
import unittest
import tempfile
from PIL import Image

# Ensure ai_pipeline parent directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from ai_pipeline import (
        run_full_ai_pipeline,
        EXIFChecker,
        ELAChecker,
        FakeDetector,
        YOLOValidator,
        duplicate_check,
        calculate_priority
    )
except ImportError:
    # Direct import fallback if run from inside ai_pipeline/
    from pipeline import run_full_ai_pipeline
    from exif_checker import EXIFChecker
    from ela_checker import ELAChecker
    from fake_detector import FakeDetector
    from yolo_validator import YOLOValidator
    from duplicate_detector import duplicate_check
    from priority_engine import calculate_priority


class TestAIPipelineIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Create a sample test JPEG image
        cls.temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        cls.temp_path = cls.temp_file.name
        cls.temp_file.close()

        img = Image.new("RGB", (320, 320), color=(120, 120, 120))
        img.save(cls.temp_path, "JPEG", quality=90)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.temp_path):
            try:
                os.remove(cls.temp_path)
            except OSError:
                pass

    def test_01_exif_checker(self):
        print("\n--- Testing Layer 1.1: EXIF Metadata ---")
        res = EXIFChecker().check(self.temp_path)
        self.assertIn("real", res)
        self.assertIn("execution_time_ms", res)
        print(f" -> EXIF Execution Time: {res.get('execution_time_ms')} ms")

    def test_02_ela_checker(self):
        print("\n--- Testing Layer 1.2: Error Level Analysis ---")
        res = ELAChecker().check(self.temp_path)
        self.assertIn("format_valid", res)
        self.assertIn("execution_time_ms", res)
        print(f" -> ELA Execution Time: {res.get('execution_time_ms')} ms")

    def test_03_priority_calculation(self):
        print("\n--- Testing Layer 4: Priority Engine ---")
        data = {
            "severity": 80.0,
            "public_safety": 90.0,
            "traffic_impact": 70.0,
            "duplicate_factor": 40.0,
            "sla_urgency": 50.0
        }
        res = calculate_priority(data)
        self.assertEqual(res["score"], 72)
        self.assertEqual(res["level"], "High")
        self.assertEqual(res["target_sla"], "48h")
        print(f" -> Priority Score: {res['score']}, Level: {res['level']}, SLA: {res['target_sla']}")

    def test_04_master_pipeline_runner(self):
        print("\n--- Testing Master Runner: run_full_ai_pipeline ---")
        res = run_full_ai_pipeline(
            photo_path=self.temp_path,
            latitude=21.1458,
            longitude=79.0882,
            category="pothole",
            description="Severe road crater near Sitabuldi market",
            complaint_id=101
        )
        self.assertIn("status", res)
        self.assertIn("priority_score", res)
        self.assertIn("target_sla", res)
        self.assertIn("total_execution_time_ms", res)
        print(f" -> Status: {res['status']}")
        print(f" -> Priority Score: {res['priority_score']} ({res['priority_level']} - {res['target_sla']})")
        print(f" -> Total Execution Time: {res['total_execution_time_ms']} ms")
        print(f" -> Stage Timings: {res['stage_timings_ms']}")


if __name__ == "__main__":
    unittest.main()
