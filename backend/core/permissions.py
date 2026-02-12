from rest_framework.permissions import BasePermission


class IsSessionParticipant(BasePermission):
    """
    Permission to check if user is a participant in the session.
    """
    
    def has_object_permission(self, request, view, obj):
        return request.user in [obj.user1, obj.user2]


class IsPostCreator(BasePermission):
    """
    Permission to check if user is the creator of the post.
    """
    
    def has_object_permission(self, request, view, obj):
        return request.user == obj.creator
