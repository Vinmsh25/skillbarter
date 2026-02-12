from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..serializers import UserSerializer, UserUpdateSerializer


class UserMeView(APIView):
    """
    Current user profile endpoint.
    GET: Retrieve current user's profile
    PATCH: Update current user's profile
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current user profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        """Update current user profile."""
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    """
    Public user profile endpoint.
    GET: Retrieve specific user's public profile
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        """Get user public profile."""
        from django.contrib.auth import get_user_model
        from ..serializers import UserPublicSerializer
        
        User = get_user_model()
        try:
            user = User.objects.get(pk=pk)
            serializer = UserPublicSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class UserListView(APIView):
    """
    List users with optional search.
    GET /api/users/?search=query
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            from django.contrib.auth import get_user_model
            from ..serializers import UserPublicSerializer
            from django.db.models import Q
            
            User = get_user_model()
            query = request.query_params.get('search', '').strip()
            
            print(f"UserListView: searching for '{query}' by user {request.user}")
            
            if query:
                users = User.objects.filter(
                    Q(name__icontains=query) | Q(email__icontains=query)
                ).exclude(is_superuser=True)[:20]  # Limit to 20 results, hide admins
            else:
                # If no query, return empty list or maybe distinct users?
                # For now, return empty to avoid listing everyone
                users = User.objects.none()
                
            serializer = UserPublicSerializer(users, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"UserListView CRASHED: {e}")
            traceback.print_exc()
            raise
