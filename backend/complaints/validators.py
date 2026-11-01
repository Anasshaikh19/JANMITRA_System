"""
Validators for complaints app (JANMITRA - Nagpur Municipal Corporation).
"""

from rest_framework.exceptions import ValidationError


def validate_worker_assignment(worker, complaint, override=False):
    """
    Validates that a worker belongs to the same department and ward as the complaint.
    Raises a DRF ValidationError when mismatches exist and override is False.
    Returns True if mismatches exist (override applied), False otherwise.
    """
    errors = []
    if worker.department_id != complaint.department_id:
        errors.append(f'Worker dept {worker.department} does not match complaint dept {complaint.department}')
    if worker.ward_id != complaint.ward_id:
        errors.append(f'Worker ward {worker.ward} does not match complaint ward {complaint.ward}')
    if errors and not override:
        raise ValidationError({'assignment_error': errors})
    return bool(errors)
