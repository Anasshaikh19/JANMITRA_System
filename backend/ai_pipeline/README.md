# JANMITRA AI Pipeline (`backend/ai_pipeline`)

**Subsystem**: Automated Civic Defect Verification & Spatial Redressal Engine  
**Author**: Om S. Gadekar (AI & Spatial Database Lead)  
**Integration Target**: `JANMITRA_System/backend/ai_pipeline/`  
**Status**: Production Ready & Fully Hardened  

---

## 1. Quick Integration for Backend Lead (Anas)

Hey Anas! This folder contains the complete, hardened AI verification pipeline for JANMITRA. You can call the entire 4-stage pipeline (Forensics $\to$ YOLOv8 $\to$ PostGIS 100m Duplicate Check $\to$ Priority Scoring) with **just 3 lines of Python**:

### Synchronous Usage (in any Django view or service):
```python
from ai_pipeline import run_full_ai_pipeline

# Call the master runner
result = run_full_ai_pipeline(
    photo_path="/path/to/complaint_image.jpg",
    latitude=21.1458,       # Citizen GPS latitude
    longitude=79.0882,      # Citizen GPS longitude
    category="pothole",     # "pothole" | "garbage" | "water leak" | "streetlight"
    description="Severe road crater near Sitabuldi market",
    complaint_id=101        # Optional ticket ID
)

print(result)
```

### Result Dictionary Returned:
```python
{
    "status": "Validated",            # "Validated" | "Pending Validation" | "Rejected"
    "is_valid": True,
    "is_fake": False,
    "is_duplicate": False,
    "parent_complaint_id": None,
    "ai_confidence": 0.914,
    "detected_tags": ["pothole"],
    "priority_score": 75,
    "priority_level": "High",         # "Critical" | "High" | "Medium" | "Low"
    "target_sla": "48h",              # "24h" | "48h" | "72h" | "7 days"
    "citizen_message": "",
    "total_execution_time_ms": 28.5
}
```

---

## 2. Asynchronous Celery Worker Usage

If you are using Celery to process complaint images asynchronously in the background (recommended so citizen mobile requests return instantly):

In your `complaints/views.py` (or wherever complaints are created):
```python
# When citizen submits complaint
complaint = Complaint.objects.create(...)

# Dispatch background task immediately
from ai_pipeline.celery_tasks import process_complaint_ai
process_complaint_ai.delay(complaint.id)

# Return HTTP 201 Created to citizen with ticket ID in < 35 ms!
```

A complete production-hardened Celery task is already written for you in [`ai_pipeline/celery_tasks.py`](celery_tasks.py).

---

## 3. Directory Layout Inside `backend/ai_pipeline/`

```text
backend/ai_pipeline/
├── __init__.py           # Exports run_full_ai_pipeline, YOLOValidator, etc.
├── pipeline.py           # Unified master runner function (3-line entrypoint)
├── yolo_validator.py     # Layer 2: YOLOv8 Civic Defect Object Detection
├── exif_checker.py       # Layer 1.1: Hardware camera EXIF metadata checker
├── ela_checker.py        # Layer 1.2: Error Level Analysis (JPEG compression noise)
├── fake_detector.py      # Layer 1.3: Vision Transformer anti-spoofing
├── duplicate_detector.py # Layer 3: PostGIS 100m Geodesic spatial deduplication
├── priority_engine.py    # Layer 4: AHP Multi-Factor Priority & SLA scoring
├── celery_tasks.py       # Production Celery worker task ready for Django
├── signals.py            # Signals for Redis cache invalidation on status change
├── test_ai_pipeline.py   # Quick 5-second smoke test script
├── requirements.txt      # Dependencies to add to backend/requirements.txt
├── weights/              # Pre-trained model weights (auto-located by yolo_validator)
│   ├── janmitra_civic_yolov8s.pt    # PyTorch fine-tuned model (22.5 MB)
│   └── janmitra_civic_yolov8s.onnx  # Optimized FP16 ONNX model (21.3 MB, 18.6ms on CPU)
├── geospatial/           # Municipal datasets
│   ├── nagpur_wards.geojson         # RFC 7946 ward boundary polygons
│   └── nagpur_seed_500.sql          # 500-complaint PostGIS seed script
└── docs/                 # Documentation, evaluation metrics, and Viva defense answers
    ├── REPORT_CHAPTER_AI_MODULE.md
    ├── VIVA_DEFENSE_GUIDE_AI.md
    ├── SPATIAL_DATABASE_REPORT.md
    └── AI_MODEL_EVALUATION.md
```

---

## 4. Dependencies to Install

Anas, just append the contents of `backend/ai_pipeline/requirements.txt` into your `backend/requirements.txt`:
```bash
pip install -r ai_pipeline/requirements.txt
```
*(Includes `torch`, `ultralytics`, `onnxruntime`, `opencv-python-headless`, `pillow`, `transformers`, `celery`, `redis`).*

---

## 5. Verification: How to Test It in 5 Seconds

From inside `backend/ai_pipeline/`, simply run:
```bash
python test_ai_pipeline.py
```
It tests all 4 layers, generates a dummy image, tests EXIF, ELA, YOLO, duplicate detection, and priority scoring, and prints `OK`.

---

## 6. Weights Auto-Detection
The `yolo_validator.py` script automatically searches for model weights in:
1. `backend/ai_pipeline/weights/`
2. `backend/weights/`
3. Current working directory

So you never have to hardcode absolute file paths!
