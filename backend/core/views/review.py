from rest_framework import status, viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Review, Session
from ..serializers import ReviewSerializer, ReviewCreateSerializer


class ReviewViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet
):
    """
    ViewSet for session reviews.
    
    Endpoints:
    - GET /sessions/{session_id}/reviews/ - List reviews for a session
    - POST /sessions/{session_id}/reviews/ - Create a review
    - GET /users/{user_id}/reviews/ - List reviews for a user (public)
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return reviews based on context."""
        session_id = self.kwargs.get('session_pk')
        user_id = self.kwargs.get('user_pk')
        
        if session_id:
            return Review.objects.filter(session_id=session_id)
        elif user_id:
            return Review.objects.filter(reviewee_id=user_id)
        
        return Review.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ReviewCreateSerializer
        return ReviewSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        
        session_id = self.kwargs.get('session_pk')
        if session_id:
            try:
                context['session'] = Session.objects.get(pk=session_id)
            except Session.DoesNotExist:
                pass
        
        return context
    
    def create(self, request, *args, **kwargs):
        """Create a review for a session."""
        session_id = self.kwargs.get('session_pk')
        
        if not session_id:
            return Response(
                {'error': 'Session ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        
        return Response(
            ReviewSerializer(review).data,
            status=status.HTTP_201_CREATED
        )
