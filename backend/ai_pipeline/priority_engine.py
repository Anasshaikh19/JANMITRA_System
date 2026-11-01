"""
AI Priority Scoring Engine Module for JANMITRA.

Calculates an actionable priority score (0-100) and urgency SLA for municipal complaints:
1. Formula:
   Score = (severity * 0.30) + (public_safety * 0.25) + (traffic_impact * 0.20) + 
           (duplicate_factor * 0.15) + (sla_urgency * 0.10)

2. Priority Tiers & Target SLAs:
   - Score >= 80 -> 'Critical' (Target SLA: 24h)
   - Score 60-79 -> 'High'     (Target SLA: 48h)
   - Score 40-59 -> 'Medium'   (Target SLA: 72h)
   - Score < 40  -> 'Low'      (Target SLA: 7 days)
"""

import math
import unittest
from typing import Dict, Any, Union

# Safety baseline scores per department category (0-100)
SAFETY_MAPPING = {
    # Electrical (Live wires, broken streetlights)
    'electrical': 90,
    'broken_streetlight': 90,
    'streetlight': 90,
    'street_light': 90,

    # Roads (Potholes, broken roads, pavement collapses)
    'roads': 80,
    'pothole': 80,
    'potholes': 80,

    # Water (Flooding, open drains, waterlogging)
    'water': 70,
    'waterlogging': 70,
    'flooding': 70,
    'drainage': 70,

    # Sanitation (Garbage dumps, overflowing bins)
    'garbage': 40,
    'trash': 40,
    'waste': 40
}

# NLP keyword lists for severity calculation
HIGH_SEVERITY_KEYWORDS = [
    'dangerous', 'injury', 'accident', 'blocked completely', 
    'flooding', 'sparking', 'live wire', 'emergency', 'collapsed'
]
MED_SEVERITY_KEYWORDS = [
    'pothole', 'broken', 'not working', 'waterlogging', 
    'overflowing', 'dark', 'no light', 'leaking', 'smelly'
]
LOW_SEVERITY_KEYWORDS = ['minor', 'small', 'cosmetic', 'faint']


def get_priority_level_and_sla(score: int) -> tuple[str, str]:
    """Maps score to priority tier and SLA target."""
    if score >= 80:
        return 'Critical', '24h'
    elif score >= 60:
        return 'High', '48h'
    elif score >= 40:
        return 'Medium', '72h'
    else:
        return 'Low', '7 days'


def calculate_priority(complaint_data: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
    """
    Priority calculation function:
    calculate_priority(complaint_data) -> {'score': int, 'level': str, 'target_sla': str}

    Computes weighted urgency score using the official 5-factor formula:
    Score = (severity * 0.30) + (public_safety * 0.25) + (traffic_impact * 0.20) + 
            (duplicate_factor * 0.15) + (sla_urgency * 0.10)

    :param complaint_data: Either a dictionary of parameters or a Django Complaint instance.
    :return: Dict containing integer score, level, target_sla, and factor breakdown.
    """
    # 1. Parameter Extraction: handle both dictionary and model object
    if isinstance(complaint_data, dict):
        # A. Check for direct numerical parameters
        has_direct_scores = all(
            k in complaint_data for k in ['severity', 'public_safety', 'traffic_impact', 'duplicate_factor', 'sla_urgency']
        )
        if has_direct_scores:
            severity = float(complaint_data['severity'])
            public_safety = float(complaint_data['public_safety'])
            traffic_impact = float(complaint_data['traffic_impact'])
            duplicate_factor = float(complaint_data['duplicate_factor'])
            sla_urgency = float(complaint_data['sla_urgency'])
        else:
            # Derived from high-level dict properties
            description = str(complaint_data.get('description', '')).lower()
            category = str(complaint_data.get('category', '')).lower()
            dup_count = int(complaint_data.get('duplicate_count', 0) or 0)

            # Severity
            severity = 50.0
            if any(kw in description for kw in HIGH_SEVERITY_KEYWORDS):
                severity += 30.0
            elif any(kw in description for kw in MED_SEVERITY_KEYWORDS):
                severity += 15.0
            severity = min(max(severity, 0.0), 100.0)

            # Public Safety
            public_safety = float(complaint_data.get('public_safety', SAFETY_MAPPING.get(category, 50)))

            # Traffic Impact
            if 'traffic_impact' in complaint_data:
                traffic_impact = float(complaint_data['traffic_impact'])
            elif any(kw in description for kw in ['traffic', 'jam', 'blocked completely', 'main road', 'highway']):
                traffic_impact = 90.0
            elif category == 'roads':
                traffic_impact = 60.0
            else:
                traffic_impact = 40.0

            # Duplicate Factor
            duplicate_factor = min(dup_count * 20.0, 100.0)

            # SLA Urgency
            sla_urgency = float(complaint_data.get('sla_urgency', 50.0))

        complaint_obj = None

    else:
        # B. Complaint model / mock object instance
        complaint_obj = complaint_data
        description = str(getattr(complaint_obj, 'description', '')).lower()
        category = str(getattr(complaint_obj, 'category', '')).lower()
        dup_count = int(getattr(complaint_obj, 'duplicate_count', 0) or 0)

        # 1. Severity (0-100)
        severity = 50.0
        if any(kw in description for kw in HIGH_SEVERITY_KEYWORDS):
            severity += 30.0
        elif any(kw in description for kw in MED_SEVERITY_KEYWORDS):
            severity += 15.0
        severity = min(max(severity, 0.0), 100.0)

        # 2. Public Safety (0-100)
        public_safety = float(SAFETY_MAPPING.get(category, 50))

        # 3. Traffic Impact (0-100)
        if any(kw in description for kw in ['traffic', 'jam', 'blocked completely', 'main road', 'highway']):
            traffic_impact = 90.0
        elif category == 'roads':
            traffic_impact = 60.0
        else:
            traffic_impact = 40.0

        # 4. Duplicate Factor (0-100)
        duplicate_factor = min(dup_count * 20.0, 100.0)

        # 5. SLA Urgency (0-100)
        # Based on department capacity / backlog
        dept = getattr(complaint_obj, 'department', None)
        active_complaints = getattr(dept, 'active_complaints', 50) if dept else 50
        total_capacity = getattr(dept, 'total_capacity', 100) if dept else 100
        if total_capacity > 0:
            sla_urgency = min(max((active_complaints / total_capacity) * 100.0, 0.0), 100.0)
        else:
            sla_urgency = 50.0

    # 2. Mathematical Weighted Formula
    raw_score = (
        (severity * 0.30) +
        (public_safety * 0.25) +
        (traffic_impact * 0.20) +
        (duplicate_factor * 0.15) +
        (sla_urgency * 0.10)
    )

    # Clamp bounds and round half-up to integer
    clamped_score = min(max(raw_score, 0.0), 100.0)
    final_score = int(math.floor(clamped_score + 0.5))

    # 3. Priority Level & Target SLA Mapping
    level, target_sla = get_priority_level_and_sla(final_score)

    # 4. If model instance was passed, persist properties
    if complaint_obj is not None:
        complaint_obj.priority_score = final_score
        complaint_obj.priority_level = level
        complaint_obj.target_sla = target_sla
        if hasattr(complaint_obj, 'save'):
            complaint_obj.save()

    return {
        'score': final_score,
        'level': level,
        'target_sla': target_sla,
        'breakdown': {
            'severity': round(severity, 1),
            'public_safety': round(public_safety, 1),
            'traffic_impact': round(traffic_impact, 1),
            'duplicate_factor': round(duplicate_factor, 1),
            'sla_urgency': round(sla_urgency, 1)
        }
    }


class PriorityEngine:
    """
    Object-oriented wrapper class providing backward compatibility
    for existing pipeline tasks and test suites.
    """

    def calculate(self, complaint) -> Dict[str, Any]:
        """Wrapper method for calculate_priority."""
        return calculate_priority(complaint)

    def calculate_priority(self, complaint_data) -> Dict[str, Any]:
        """Direct alias for calculate_priority function."""
        return calculate_priority(complaint_data)


# =====================================================================
# Unit Test Cases
# =====================================================================

class TestPriorityEngine(unittest.TestCase):
    """Unit test suite verifying formulas, thresholds, and SLAs."""

    def test_critical_priority(self):
        # Critical scenario: High values across all factors -> Score >= 80 (SLA: 24h)
        # (90*0.30) + (90*0.25) + (85*0.20) + (80*0.15) + (70*0.10)
        # = 27.0 + 22.5 + 17.0 + 12.0 + 7.0 = 85.5 -> 86 (Critical)
        data = {
            'severity': 90,
            'public_safety': 90,
            'traffic_impact': 85,
            'duplicate_factor': 80,
            'sla_urgency': 70
        }
        res = calculate_priority(data)
        self.assertGreaterEqual(res['score'], 80)
        self.assertEqual(res['level'], 'Critical')
        self.assertEqual(res['target_sla'], '24h')
        self.assertEqual(res['score'], 86)

    def test_high_priority(self):
        # High scenario: Score between 60 and 79 (SLA: 48h)
        # (70*0.30) + (80*0.25) + (60*0.20) + (50*0.15) + (60*0.10)
        # = 21.0 + 20.0 + 12.0 + 7.5 + 6.0 = 66.5 -> 67 (High)
        data = {
            'severity': 70,
            'public_safety': 80,
            'traffic_impact': 60,
            'duplicate_factor': 50,
            'sla_urgency': 60
        }
        res = calculate_priority(data)
        self.assertTrue(60 <= res['score'] <= 79)
        self.assertEqual(res['level'], 'High')
        self.assertEqual(res['target_sla'], '48h')
        self.assertEqual(res['score'], 67)

    def test_medium_priority(self):
        # Medium scenario: Score between 40 and 59 (SLA: 72h)
        # (50*0.30) + (50*0.25) + (50*0.20) + (40*0.15) + (50*0.10)
        # = 15.0 + 12.5 + 10.0 + 6.0 + 5.0 = 48.5 -> 49 (Medium)
        data = {
            'severity': 50,
            'public_safety': 50,
            'traffic_impact': 50,
            'duplicate_factor': 40,
            'sla_urgency': 50
        }
        res = calculate_priority(data)
        self.assertTrue(40 <= res['score'] <= 59)
        self.assertEqual(res['level'], 'Medium')
        self.assertEqual(res['target_sla'], '72h')
        self.assertEqual(res['score'], 49)

    def test_low_priority(self):
        # Low scenario: Score < 40 (SLA: 7 days)
        # (30*0.30) + (40*0.25) + (20*0.20) + (10*0.15) + (30*0.10)
        # = 9.0 + 10.0 + 4.0 + 1.5 + 3.0 = 27.5 -> 28 (Low)
        data = {
            'severity': 30,
            'public_safety': 40,
            'traffic_impact': 20,
            'duplicate_factor': 10,
            'sla_urgency': 30
        }
        res = calculate_priority(data)
        self.assertLess(res['score'], 40)
        self.assertEqual(res['level'], 'Low')
        self.assertEqual(res['target_sla'], '7 days')
        self.assertEqual(res['score'], 28)

    def test_exact_boundary_thresholds(self):
        # Exactly 80 -> Critical
        res_80 = calculate_priority({'severity': 80, 'public_safety': 80, 'traffic_impact': 80, 'duplicate_factor': 80, 'sla_urgency': 80})
        self.assertEqual(res_80['score'], 80)
        self.assertEqual(res_80['level'], 'Critical')

        # Exactly 60 -> High
        res_60 = calculate_priority({'severity': 60, 'public_safety': 60, 'traffic_impact': 60, 'duplicate_factor': 60, 'sla_urgency': 60})
        self.assertEqual(res_60['score'], 60)
        self.assertEqual(res_60['level'], 'High')

        # Exactly 40 -> Medium
        res_40 = calculate_priority({'severity': 40, 'public_safety': 40, 'traffic_impact': 40, 'duplicate_factor': 40, 'sla_urgency': 40})
        self.assertEqual(res_40['score'], 40)
        self.assertEqual(res_40['level'], 'Medium')

        # Exactly 39 -> Low
        res_39 = calculate_priority({'severity': 39, 'public_safety': 39, 'traffic_impact': 39, 'duplicate_factor': 39, 'sla_urgency': 39})
        self.assertEqual(res_39['score'], 39)
        self.assertEqual(res_39['level'], 'Low')


if __name__ == '__main__':
    unittest.main()
