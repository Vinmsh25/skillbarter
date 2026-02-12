from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import LearningRequestPost
from ..serializers import (
    LearningRequestPostSerializer,
    LearningRequestPostCreateSerializer
)


class LearningRequestPostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for learning request posts.
    
    Endpoints:
    - GET /posts/ - List all active posts (excludes completed)
    - POST /posts/ - Create a new learning post
    - GET /posts/{id}/ - Get post details
    - PATCH /posts/{id}/complete/ - Mark post as completed
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Return active posts only.
        Completed posts are excluded from all queries.
        """
        queryset = LearningRequestPost.objects.filter(is_completed=False)
        
        # Filter by topic if provided
        topic = self.request.query_params.get('topic', None)
        if topic:
            queryset = queryset.filter(
                topic_to_learn__icontains=topic
            ) | queryset.filter(
                topic_to_teach__icontains=topic
            )
        
        # Filter by creator if provided
        creator_id = self.request.query_params.get('creator', None)
        if creator_id:
            queryset = queryset.filter(creator_id=creator_id)
        
        return queryset.select_related('creator')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LearningRequestPostCreateSerializer
        return LearningRequestPostSerializer
    
    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Override create to return full post data with creator info."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Re-serialize with the full serializer to include creator_name, etc.
        post = serializer.instance
        response_serializer = LearningRequestPostSerializer(post)
        
        from rest_framework import status
        from rest_framework.response import Response
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'])
    def complete(self, request, pk=None):
        """
        Mark a learning request post as completed.
        Only the creator can mark their post as completed.
        """
        post = self.get_object()
        
        if post.creator != request.user:
            return Response(
                {'error': 'Only the creator can mark this post as completed.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if post.is_completed:
            return Response(
                {'error': 'Post is already completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        post.mark_completed()
        
        return Response({
            'message': 'Post marked as completed.',
            'post': LearningRequestPostSerializer(post).data
        })
    
    @action(detail=False, methods=['get'])
    def my_posts(self, request):
        """
        Get current user's active posts only.
        Completed posts are never shown.
        """
        posts = LearningRequestPost.objects.filter(
            creator=request.user,
            is_completed=False
        )
        serializer = LearningRequestPostSerializer(posts, many=True)
        return Response(serializer.data)
