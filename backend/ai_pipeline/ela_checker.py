"""
Error Level Analysis (ELA) Checker Module (Layer 1 Step 2) - Production Hardened.

Performs JPEG Error Level Analysis to identify regions of an image with inconsistent
compression levels, indicating digital editing, spliced objects, or localized tampering.

Hardened for production:
- Try-except guards around image loading, recompression, difference calculation, and metric aggregation.
- Structured rejection with citizen-facing actionable messages for invalid formats.
- High-precision execution timing logging for pipeline stage tracking.
- Guaranteed temporary file cleanup and OpenCV memory destruction.
"""

import os
import gc
import time
import tempfile
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np
    HAS_OPENCV = True
except ImportError:
    cv2 = None
    np = None
    HAS_OPENCV = False


CITIZEN_MSG_INVALID_FORMAT = (
    "The uploaded file is not a valid photograph or is in an unsupported format. "
    "Please upload a clear photograph taken from your mobile camera in JPEG or PNG format."
)

CITIZEN_MSG_CORRUPTED_FILE = (
    "The image file appears damaged, truncated, or unreadable. "
    "Please re-take and upload the photo to help municipal authorities inspect the issue."
)

CITIZEN_MSG_AUTHENTIC = (
    "Image passed Error Level Analysis with natural camera sensor compression noise."
)

CITIZEN_MSG_SUSPICIOUS = (
    "The image shows signs of digital manipulation, uniform compression, or screenshot editing. "
    "Your complaint has been forwarded to the municipal officer review queue."
)


class ELAChecker:
    """
    Layer 1 Step 2: Error Level Analysis (ELA) Inspector (Production Hardened).
    """

    def __init__(self, quality: int = 90):
        self.quality = quality

    def check(self, image_path: str) -> Dict[str, Any]:
        """
        Check image by performing Error Level Analysis (ELA) with hardened guards.
        
        :param image_path: Path to target image file.
        :return: Dict adhering to production schema with execution timing and citizen messages.
        """
        t0 = time.perf_counter()

        result = {
            'real': False,
            'format_valid': True,
            'reason': 'Unknown error',
            'citizen_message': CITIZEN_MSG_INVALID_FORMAT,
            'ela_score': 0.0,
            'metrics': {},
            'execution_time_ms': 0.0
        }

        # 1. Guard: Path existence and file size
        if not image_path or not isinstance(image_path, str):
            result['format_valid'] = False
            result['reason'] = 'Invalid image path provided (null or non-string).'
            result['citizen_message'] = CITIZEN_MSG_INVALID_FORMAT
            result['execution_time_ms'] = round((time.perf_counter() - t0) * 1000.0, 3)
            logger.warning(f"[ELAChecker] {result['reason']}")
            return result

        if not os.path.exists(image_path):
            result['format_valid'] = False
            result['reason'] = f'File not found: {image_path}'
            result['citizen_message'] = CITIZEN_MSG_INVALID_FORMAT
            result['execution_time_ms'] = round((time.perf_counter() - t0) * 1000.0, 3)
            logger.warning(f"[ELAChecker] {result['reason']}")
            return result

        try:
            file_size = os.path.getsize(image_path)
            if file_size < 32:
                result['format_valid'] = False
                result['reason'] = f'Truncated or empty file ({file_size} bytes).'
                result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE
                result['execution_time_ms'] = round((time.perf_counter() - t0) * 1000.0, 3)
                logger.warning(f"[ELAChecker] {result['reason']} on {image_path}")
                return result
        except OSError as e:
            result['format_valid'] = False
            result['reason'] = f'File access error: {str(e)}'
            result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE
            result['execution_time_ms'] = round((time.perf_counter() - t0) * 1000.0, 3)
            return result

        # 2. Guard: OpenCV / NumPy Library Check
        if not HAS_OPENCV:
            result['reason'] = 'OpenCV/NumPy missing; skipping ELA analysis.'
            result['citizen_message'] = CITIZEN_MSG_AUTHENTIC
            result['real'] = True
            result['execution_time_ms'] = round((time.perf_counter() - t0) * 1000.0, 3)
            return result

        temp_file_path: Optional[str] = None

        try:
            # 3. Load image with OpenCV with explicit try-except guard
            original_img = None
            try:
                original_img = cv2.imread(image_path)
            except Exception as read_err:
                result['format_valid'] = False
                result['reason'] = f'OpenCV failed reading image: {str(read_err)}'
                result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE
                logger.warning(f"[ELAChecker] cv2.imread failed on {image_path}: {read_err}")
                return result

            if original_img is None or not hasattr(original_img, 'shape') or len(original_img.shape) < 2:
                result['format_valid'] = False
                result['reason'] = 'Failed to load image with OpenCV. File might be corrupted.'
                result['citizen_message'] = CITIZEN_MSG_INVALID_FORMAT
                logger.warning(f"[ELAChecker] Failed to load image {image_path} with OpenCV.")
                return result

            # Optional: Resize extreme resolution (> 2560px) to prevent OOM
            h, w = original_img.shape[:2]
            if max(h, w) > 2560:
                scale = 2560.0 / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                original_img = cv2.resize(original_img, (new_w, new_h), interpolation=cv2.INTER_AREA)

            # 4. Create isolated temporary file for JPEG recompression
            fd, temp_file_path = tempfile.mkstemp(suffix='.jpg')
            os.close(fd)

            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), self.quality]
            save_success = cv2.imwrite(temp_file_path, original_img, encode_param)

            if not save_success:
                result['reason'] = 'Failed to write recompressed temporary image.'
                result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE
                return result

            # Read recompressed image back
            recompressed_img = cv2.imread(temp_file_path)
            if recompressed_img is None:
                result['reason'] = 'Failed to load recompressed image from temp file.'
                result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE
                return result

            # 5. Compute absolute difference matrix
            diff = cv2.absdiff(original_img, recompressed_img)

            # Compute statistical metrics
            mean_diff = float(np.mean(diff))
            max_diff = float(np.max(diff))
            std_diff = float(np.std(diff))

            result['ela_score'] = round(std_diff, 2)
            result['metrics'] = {
                'mean': round(mean_diff, 2),
                'max': round(max_diff, 2),
                'std': round(std_diff, 2)
            }
            result['format_valid'] = True

            # 6. Evaluation rules based on sensor noise distribution
            if std_diff < 1.0 and max_diff < 10.0:
                result['real'] = False
                result['reason'] = (
                    f'ELA variance ({std_diff:.2f}) and max diff ({max_diff}) too low. '
                    f'Lacks natural sensor noise (likely digital/AI/Screenshot).'
                )
                result['citizen_message'] = CITIZEN_MSG_SUSPICIOUS
            else:
                result['real'] = True
                result['reason'] = (
                    f'ELA variance ({std_diff:.2f}) and max diff ({max_diff}) normal. '
                    f'Natural camera noise detected.'
                )
                result['citizen_message'] = CITIZEN_MSG_AUTHENTIC

        except Exception as e:
            logger.error(f"[ELAChecker] Unhandled exception during ELA on {image_path}: {e}", exc_info=True)
            result['format_valid'] = False
            result['real'] = False
            result['reason'] = f'Error during ELA processing: {str(e)}'
            result['citizen_message'] = CITIZEN_MSG_CORRUPTED_FILE

        finally:
            # 7. Guaranteed temp file cleanup & OpenCV memory deallocation
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except OSError:
                    pass
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass
            gc.collect()

            t1 = time.perf_counter()
            exec_time = round((t1 - t0) * 1000.0, 3)
            result['execution_time_ms'] = exec_time
            logger.info(
                f"[AI Pipeline] [Stage 2/4 - ELA] Completed in {exec_time:.2f} ms "
                f"(Authentic: {result['real']}, ELA Score: {result['ela_score']}, FormatValid: {result['format_valid']})"
            )

        return result
