"""
Django Signal Handlers for JANMITRA Complaints App.

Connects Django post_save signal on Complaint to automatically invalidate
dashboard Redis cache whenever a complaint is created or modified.

Ensures real-time dashboard consistency for:
- Spatial Ward Density Clusters
- Moving Average Resolution Trends
- Category Resolution Success Rates
- Ward 4x4 Heatmaps
- Civic Health Index Scores
- Master Composite Analytics
"""

import logging
from typing import List, Optional, Any

logger = logging.getLogger(__name__)

# Safe Django signals import with standalone dispatcher fallback
try:
    from django.db.models.signals import post_save, pre_save
    from django.dispatch import receiver, Signal
    HAS_DJANGO_SIGNALS = True
except ImportError:
    HAS_DJANGO_SIGNALS = False

    class StandaloneSignal:
        """Lightweight signal dispatcher for standalone testing and CI environments."""
        def __init__(self):
            self._receivers = []

        def connect(self, receiver, sender=None, weak=True, dispatch_uid=None):
            if dispatch_uid:
                self._receivers = [r for r in self._receivers if r[2] != dispatch_uid]
            self._receivers.append((receiver, sender, dispatch_uid))

        def disconnect(self, receiver=None, dispatch_uid=None):
            if dispatch_uid:
                self._receivers = [r for r in self._receivers if r[2] != dispatch_uid]
            elif receiver:
                self._receivers = [r for r in self._receivers if r[0] != receiver]

        def send(self, sender, **named):
            responses = []
            for r, s, _ in list(self._receivers):
                if s is None or s == sender:
                    response = r(sender=sender, **named)
                    responses.append((r, response))
            return responses

    post_save = StandaloneSignal()
    pre_save = StandaloneSignal()

    def receiver(signal, **kwargs):
        def _decorator(func):
            sender = kwargs.get('sender', None)
            dispatch_uid = kwargs.get('dispatch_uid', None)
            signal.connect(func, sender=sender, dispatch_uid=dispatch_uid)
            return func
        return _decorator

# Cache reference (Django Redis cache or fallback in-memory cache)
try:
    from django.core.cache import cache
except ImportError:
    try:
        from dashboard.views import cache
    except ImportError:
        class InMemoryCache:
            def __init__(self):
                self._storage = {}
            def get(self, key, default=None):
                return self._storage.get(key, default)
            def set(self, key, value, timeout=None):
                self._storage[key] = value
            def delete(self, key):
                return self._storage.pop(key, None)
            def delete_pattern(self, pattern):
                import fnmatch
                keys_to_del = [k for k in self._storage.keys() if fnmatch.fnmatch(k, pattern)]
                for k in keys_to_del:
                    self._storage.pop(k, None)
                return len(keys_to_del)
            def clear(self):
                self._storage.clear()
        cache = InMemoryCache()


# ==============================================================================
# Known Dashboard Cache Key Prefixes & Templates
# ==============================================================================

DASHBOARD_CACHE_KEY_PATTERNS = [
    "dashboard_kpi_*",
    "dashboard_ward_stats_*",
    "dashboard_*",
    "janmitra_spatial_clusters_*",
    "janmitra_cat_success_rates_*",
    "janmitra_ma_res_*",
    "janmitra_master_analytics_*",
    "janmitra_kpi_*",
    "janmitra_ward_stats_*",
    "janmitra_civic_health_*",
    "janmitra_bottlenecks_*",
    "janmitra_trends_*",
    "janmitra_density_*",
]

KNOWN_STATIC_CACHE_KEYS = [
    "dashboard_kpi_all",
    "dashboard_ward_stats_all",
    "dashboard_ward_stats_all_matrix",
    "dashboard_ward_stats_all_grouped",
    "dashboard_ward_stats_all_summary",
    "dashboard_kpi_1",
    "dashboard_kpi_2",
    "dashboard_kpi_3",
    "dashboard_kpi_4",
    "dashboard_ward_stats_PWD_matrix",
    "dashboard_ward_stats_SWM_matrix",
    "dashboard_ward_stats_PHE_matrix",
    "dashboard_ward_stats_Electrical_matrix",
    "janmitra_spatial_clusters_Ward 1-Ward 2-Ward 3-Ward 4",
    "janmitra_cat_success_rates_all",
    "janmitra_cat_success_rates_1",
    "janmitra_cat_success_rates_2",
    "janmitra_cat_success_rates_3",
    "janmitra_cat_success_rates_4",
    "janmitra_ma_res_all_30d",
    "janmitra_ma_res_all_7d",
    "janmitra_ma_res_1_30d",
    "janmitra_ma_res_2_30d",
    "janmitra_ma_res_3_30d",
    "janmitra_ma_res_4_30d",
    "janmitra_master_analytics_all_30d",
    "janmitra_master_analytics_1_30d",
    "janmitra_master_analytics_2_30d",
    "janmitra_master_analytics_3_30d",
    "janmitra_master_analytics_4_30d",
    "janmitra_kpi_all",
    "janmitra_ward_stats_all",
    "janmitra_civic_health_all",
    "janmitra_bottlenecks_all",
]


# ==============================================================================
# Cache Invalidation Logic
# ==============================================================================

def invalidate_dashboard_cache_keys(extra_keys: Optional[List[str]] = None) -> int:
    """
    Purges all dashboard analytics and KPI cache keys from Redis.
    
    Strategies:
    1. Pattern deletion via django-redis: `cache.delete_pattern('dashboard_*')`, etc.
    2. Redis client SCAN + UNLINK/DEL
    3. Iteration over known static dashboard keys
    4. In-memory storage pattern matching
    
    :param extra_keys: Additional specific cache keys to purge.
    :return: Number of cache keys invalidated.
    """
    purged_count = 0
    all_keys_to_delete = set(KNOWN_STATIC_CACHE_KEYS)
    if extra_keys:
        all_keys_to_delete.update(extra_keys)

    # 1. Try django-redis pattern deletion (preferred in production Redis)
    if hasattr(cache, 'delete_pattern'):
        try:
            for pattern in DASHBOARD_CACHE_KEY_PATTERNS:
                count = cache.delete_pattern(pattern)
                purged_count += (count or 0)
        except Exception as err:
            logger.debug("cache.delete_pattern raised error: %s", err)

    # 2. Try Redis native client scan if available
    elif hasattr(cache, 'client') or hasattr(cache, '_cache'):
        try:
            raw_client = getattr(cache, 'client', None) or getattr(cache, '_cache', None)
            if hasattr(raw_client, 'get_client'):
                redis_client = raw_client.get_client()
                for pattern in DASHBOARD_CACHE_KEY_PATTERNS:
                    keys = redis_client.keys(f"*{pattern}*")
                    if keys:
                        redis_client.delete(*keys)
                        purged_count += len(keys)
        except Exception as err:
            logger.debug("Direct Redis client scan raised error: %s", err)

    # 3. Direct key deletion for static keys
    for key in all_keys_to_delete:
        try:
            if hasattr(cache, 'get') and cache.get(key) is not None:
                cache.delete(key)
                purged_count += 1
            elif hasattr(cache, 'delete'):
                cache.delete(key)
        except Exception:
            pass

    # 4. Fallback for custom in-memory dict cache
    if hasattr(cache, '_storage') and isinstance(cache._storage, dict):
        import fnmatch
        storage_keys = list(cache._storage.keys())
        for k in storage_keys:
            if any(fnmatch.fnmatch(k, pat) or k.startswith('janmitra_') or k.startswith('dashboard_') for pat in DASHBOARD_CACHE_KEY_PATTERNS):
                cache._storage.pop(k, None)
                purged_count += 1

    return purged_count


# ==============================================================================
# Pre-Save Signal Handler (Tracks Status Change)
# ==============================================================================

@receiver(pre_save, dispatch_uid='janmitra_complaint_pre_save_status_tracker')
def track_complaint_status_before_save(sender, instance, **kwargs):
    """
    Tracks previous status prior to saving to determine if status was modified.
    """
    if getattr(instance, 'pk', None) or (hasattr(instance, 'id') and getattr(instance, '_already_saved', False)):
        pk = getattr(instance, 'pk', None) or getattr(instance, 'id', None)
        try:
            if hasattr(sender, 'objects') and sender.objects:
                prev = sender.objects.filter(pk=pk).values('status').first()
                if prev:
                    instance._pre_save_status = prev.get('status')
        except Exception:
            pass
    if not hasattr(instance, '_pre_save_status') and hasattr(instance, '_initial_status'):
        instance._pre_save_status = instance._initial_status


# ==============================================================================
# Post-Save Signal Handler (Invalidates Cache on Status Change)
# ==============================================================================

@receiver(post_save, dispatch_uid='janmitra_complaint_post_save_cache_invalidation')
def invalidate_dashboard_cache_on_complaint_save(sender, instance, created: bool = False, **kwargs):
    """
    Django post_save signal handler for Complaint model.
    Triggered whenever a Complaint is saved.
    Automatically invalidates Redis dashboard caches when Complaint status changes
    (e.g., Submitted -> Validated -> Routed -> In-Progress -> Work Done / Closed / Rejected).
    """
    old_status = getattr(instance, '_pre_save_status', getattr(instance, '_initial_status', None))
    new_status = getattr(instance, 'status', None)

    # Detect if status changed:
    # 1. Newly created complaint (enters system at initial status)
    # 2. Existing complaint where old_status != new_status
    # 3. Explicit status change flag (_status_changed)
    status_changed = (
        created
        or (old_status is not None and new_status is not None and old_status != new_status)
        or getattr(instance, '_status_changed', False)
        or kwargs.get('status_changed', False)
        or (old_status is None and created is False)  # safe fallback
    )

    if not status_changed and old_status is not None:
        logger.debug(
            f"Complaint #{getattr(instance, 'id', 'unknown')} saved without status change "
            f"(status remains '{new_status}'). Preserving dashboard cache."
        )
        return 0

    complaint_id = getattr(instance, 'complaint_id', getattr(instance, 'id', 'unknown'))
    department = getattr(instance, 'department', None)

    # Specific dynamic keys affected by this complaint
    specific_keys = []
    if department:
        specific_keys.extend([
            f"dashboard_kpi_{department}",
            f"dashboard_ward_stats_{department}_matrix",
            f"janmitra_cat_success_rates_{department}",
            f"janmitra_ma_res_{department}_30d",
            f"janmitra_master_analytics_{department}_30d",
        ])

    purged = invalidate_dashboard_cache_keys(extra_keys=specific_keys)

    # Sync tracker status for subsequent saves
    instance._pre_save_status = new_status
    instance._initial_status = new_status
    if hasattr(instance, '_status_changed'):
        instance._status_changed = False

    action = "Created" if created else f"Status Changed ({old_status} -> {new_status})"
    logger.info(
        f"[Redis Cache Invalidation] Complaint #{complaint_id} {action}. "
        f"Purged {purged} dashboard cache keys."
    )
    return purged


# Backward compatibility alias
invalidate_dashboard_cache_on_status_change = invalidate_dashboard_cache_on_complaint_save


# Connect explicitly to Complaint if imported
try:
    from complaints.models import Complaint
    pre_save.connect(
        track_complaint_status_before_save,
        sender=Complaint,
        dispatch_uid='janmitra_complaint_pre_save_status_tracker'
    )
    post_save.connect(
        invalidate_dashboard_cache_on_complaint_save,
        sender=Complaint,
        dispatch_uid='janmitra_complaint_post_save_cache_invalidation'
    )
except Exception:
    pass
