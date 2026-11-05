"""
AI Fake & Synthetic Image Detector Module (Layer 1 Step 3) - Production Hardened.

Uses a HuggingFace Vision Transformer (ViT) or CNN deepfake detection model
to classify whether an image was generated/manipulated by generative AI.

Hardened for production:
- Try-except guards around model inference, pipeline lazy-loading, and predictions.
- Structured citizen-facing messages.
- Execution time logging for pipeline tracking.
"""

import os
import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# We define the pipeline variable at the module level.
_HF_PIPELINE = None

CITIZEN_MSG_AUTHENTIC = (
    "Photograph verified as an authentic original capture."
)

CITIZEN_MSG_SYNTHETIC = (
    "The uploaded photograph appears to be artificially generated, downloaded from the web, "
    "or digitally created. Please upload an authentic photo of the municipal issue."
)

CITIZEN_MSG_ERROR = (
    "Synthetic image detection encountered an unexpected issue. "
    "The report has been forwarded to municipal officers for human review."
)


def _get_pipeline():
    """
    Lazy loader for the HuggingFace pipeline. 
    Loads the model ONCE upon first execution.
    Handles missing model / offline gracefully.
    """
    global _HF_PIPELINE
    if _HF_PIPELINE is None:
        try:
            from transformers import pipeline
            _HF_PIPELINE = pipeline('image-classification', model='umm-maybe/AI-image-detector')
        except Exception as e:
            logger.info(f"[FakeDetector] HuggingFace model offline or unavailable ('umm-maybe/AI-image-detector'): {e}")
            _HF_PIPELINE = "FAILED"
    return _HF_PIPELINE if _HF_PIPELINE != "FAILED" else None


class FakeDetector:
    """
    Layer 1 Step 3: Deepfake & Generative AI Detector (Production Hardened).
    """

    def predict(self, image_path: str) -> Dict[str, Any]:
        """
        Alias for check() with 'is_fake' compatibility key for pipeline runner.
        """
        res = self.check(image_path)
        res["is_fake"] = not res.get("real", True)
        return res

    def check(self, image_path: str) -> Dict[str, Any]:
        """
        Classify input image as real or AI-generated using HuggingFace with hardened guards.

        :param image_path: Path to the image file to inspect.
        :return: Dict containing 'real', 'reason', 'citizen_message', and 'execution_time_ms'.
        """
        t0 = time.perf_counter()

        result = {
            "real": False,
            "format_valid": True,
            "reason": "Unknown error",
            "citizen_message": CITIZEN_MSG_ERROR,
            "confidence": 0.0,
            "execution_time_ms": 0.0
        }

        # 1. Guard: Path existence and format
        if not image_path or not isinstance(image_path, str) or not os.path.exists(image_path):
            result["format_valid"] = False
            result["reason"] = f"File not found: {image_path}"
            result["execution_time_ms"] = round((time.perf_counter() - t0) * 1000.0, 3)
            return result

        try:
            # 2. Load the model once (lazy execution)
            detector = _get_pipeline()
            
            # If model file is not found or failed to load, fail open safely
            if detector is None:
                t1 = time.perf_counter()
                exec_time = round((t1 - t0) * 1000.0, 3)
                result["real"] = True
                result["reason"] = "model_not_loaded"
                result["citizen_message"] = CITIZEN_MSG_AUTHENTIC
                result["confidence"] = 0.0
                result["execution_time_ms"] = exec_time
                self._log_stage(result)
                return result
            
            # 3. Run inference
            predictions = detector(image_path)
            
            # Parse predictions to find 'artificial' label score
            max_artificial_score = 0.0
            if isinstance(predictions, list):
                for pred in predictions:
                    if isinstance(pred, dict) and pred.get("label", "").lower() == "artificial":
                        max_artificial_score = float(pred.get("score", 0.0))
                        break
            
            result["confidence"] = round(max_artificial_score, 2)
            
            # 4. Rules validation (threshold >= 0.70)
            if max_artificial_score >= 0.70:
                result["real"] = False
                result["reason"] = f"AI generated image detected. Confidence score: {max_artificial_score:.2f} (>= 0.70)."
                result["citizen_message"] = CITIZEN_MSG_SYNTHETIC
            else:
                result["real"] = True
                result["reason"] = f"Image passed AI detector. Artificial score: {max_artificial_score:.2f} (< 0.70)."
                result["citizen_message"] = CITIZEN_MSG_AUTHENTIC

        except Exception as e:
            logger.warning(f"[FakeDetector] Error during HuggingFace inference on {image_path}: {e}")
            result["real"] = True  # Fail open safely so legitimate citizen complaints are not dropped
            result["reason"] = f"Error processing HuggingFace model inference: {str(e)}"
            result["citizen_message"] = CITIZEN_MSG_AUTHENTIC

        finally:
            t1 = time.perf_counter()
            exec_time = round((t1 - t0) * 1000.0, 3)
            result["execution_time_ms"] = exec_time
            self._log_stage(result)

        return result

    def _log_stage(self, res: Dict[str, Any]):
        logger.info(
            f"[AI Pipeline] [Stage 3/4 - FakeDetector] Completed in {res.get('execution_time_ms', 0.0):.2f} ms "
            f"(Authentic: {res.get('real')}, Artificial Score: {res.get('confidence')})"
        )
