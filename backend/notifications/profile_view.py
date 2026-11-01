"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/profile_view.py
Author: Team ResolveIT
Description: Citizen Profile & Password Management View (GET, PATCH)
==============================================================================
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

# Simulated in-memory profile store for rapid dev and fallback
DEFAULT_CITIZEN_PROFILE = {
    "name": "Faizan Rayeen",
    "full_name": "Faizan Rayeen",
    "mobile": "9823013210",
    "email": "faizan.rayeen@example.com",
    "ward": 2,
    "ward_name": "Ward 2",
    "account_status": "Active Citizen",
    "member_since": "March 2026",
    "stats": {
        "total": 8,
        "resolved": 6,
        "pending": 2,
        "avg_rating": 4.8,
        "rating_count": 6,
        "satisfaction_score": 96,
        "satisfaction_grade": "Grade A+ (Excellent Citizen Feedback)",
        "rating_breakdown": {
            "5": 4,
            "4": 2,
            "3": 0,
            "2": 0,
            "1": 0
        }
    },
    "reviews": [
        {
            "id": "rev-1",
            "complaint_id": "c-102",
            "tracking_id": "NMC-2026-B1032",
            "title": "Overflowing Garbage Dump near Mangalwari Bazaar",
            "category": "Garbage & Waste",
            "department": "Solid Waste Management",
            "rating": 5,
            "resolved_at": "09 Oct 2026",
            "remarks": "Prompt sanitation response! The bin was completely emptied and area disinfected within 24 hours of reporting.",
            "worker_name": "Sunita Deshmukh"
        },
        {
            "id": "rev-2",
            "complaint_id": "c-100",
            "tracking_id": "NMC-2026-W8820",
            "title": "Water Pipeline Leakage at Mangalwari Chowk",
            "category": "Water & Drainage",
            "department": "Public Health Engineering",
            "rating": 5,
            "resolved_at": "16 Oct 2026",
            "remarks": "Underground pipe crack was welded and repaired cleanly. Water pressure restored without any lingering leakage.",
            "worker_name": "Suresh Kamble"
        },
        {
            "id": "rev-3",
            "complaint_id": "c-098",
            "tracking_id": "NMC-2026-P7712",
            "title": "Pothole on Central Avenue Junction",
            "category": "Roads & Infrastructure",
            "department": "PWD",
            "rating": 4,
            "resolved_at": "02 Oct 2026",
            "remarks": "Potholes filled with bitumen premix. Smooth finish, though repair crew arrived a few hours after scheduled slot.",
            "worker_name": "Ramesh Patil"
        },
        {
            "id": "rev-4",
            "complaint_id": "c-095",
            "tracking_id": "NMC-2026-E6540",
            "title": "Streetlight Flickering on Kadbi Chowk Lane",
            "category": "Street Lighting",
            "department": "Electrical",
            "rating": 5,
            "resolved_at": "24 Sep 2026",
            "remarks": "Faulty LED driver on lane pole replaced quickly by lineman. Night visibility is back to normal.",
            "worker_name": "Dinesh Meshram"
        },
        {
            "id": "rev-5",
            "complaint_id": "c-091",
            "tracking_id": "NMC-2026-S5411",
            "title": "Illegal Roadside Garbage Dump",
            "category": "Garbage & Waste",
            "department": "Solid Waste Management",
            "rating": 5,
            "resolved_at": "15 Sep 2026",
            "remarks": "Debris and solid waste removed completely by hydraulic tipper truck. Very satisfied.",
            "worker_name": "Sunita Deshmukh"
        },
        {
            "id": "rev-6",
            "complaint_id": "c-088",
            "tracking_id": "NMC-2026-W4390",
            "title": "Open Drain Clogged with Silt",
            "category": "Water & Drainage",
            "department": "Public Health Engineering",
            "rating": 4,
            "resolved_at": "05 Sep 2026",
            "remarks": "Drain cleared properly before heavy rain. Workers did a thorough de-silting job.",
            "worker_name": "Vinod Thakre"
        }
    ]
}



class UserProfileView(APIView):
    """
    GET   /api/v1/auth/profile/
    PATCH /api/v1/auth/profile/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user and request.user.is_authenticated else None
        if user:
            name = getattr(user, 'name', '') or getattr(user, 'first_name', '') or user.username
            mobile = getattr(user, 'mobile', '') or getattr(user, 'username', '9823013210')
            ward = getattr(user, 'ward', 2)
            return Response({
                "name": name,
                "full_name": name,
                "mobile": mobile,
                "email": user.email or DEFAULT_CITIZEN_PROFILE["email"],
                "ward": ward,
                "ward_name": f"Ward {ward}",
                "account_status": "Active Citizen",
                "member_since": DEFAULT_CITIZEN_PROFILE["member_since"],
                "stats": DEFAULT_CITIZEN_PROFILE["stats"],
                "reviews": DEFAULT_CITIZEN_PROFILE["reviews"]
            }, status=status.HTTP_200_OK)

        return Response(DEFAULT_CITIZEN_PROFILE, status=status.HTTP_200_OK)

    def patch(self, request):
        data = request.data
        user = request.user if request.user and request.user.is_authenticated else None

        updated_name = data.get("name") or data.get("full_name")
        if updated_name:
            DEFAULT_CITIZEN_PROFILE["name"] = updated_name
            DEFAULT_CITIZEN_PROFILE["full_name"] = updated_name
            if user:
                user.first_name = updated_name
                user.save(update_fields=['first_name'])

        new_password = data.get("new_password")
        if new_password and user:
            user.set_password(new_password)
            user.save()

        return Response({
            "message": "Profile updated successfully.",
            "profile": DEFAULT_CITIZEN_PROFILE
        }, status=status.HTTP_200_OK)
