from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView
from django.contrib.auth import get_user_model

from ..models import CreditTransaction
from ..serializers import CreditTransactionSerializer

User = get_user_model()


class CreditTransactionListView(ListAPIView):
    """
    List credit transactions for the current user.
    
    Query params:
    - type: Filter by transaction type (TEACHING, LEARNING, SIGNUP, SUPPORT, BANK_CUT)
    - limit: Number of transactions to return (default 50)
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = CreditTransactionSerializer
    
    def get_queryset(self):
        queryset = CreditTransaction.objects.filter(user=self.request.user)
        
        # Filter by transaction type if provided
        tx_type = self.request.query_params.get('type', None)
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type.upper())
        
        return queryset.order_by('-created_at')[:50]


class CreditBalanceView(APIView):
    """Get current user's credit balance."""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response({
            'credits': float(request.user.credits),
            'email': request.user.email,
            'name': request.user.name,
        })
