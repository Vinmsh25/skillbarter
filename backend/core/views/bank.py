from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from datetime import timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Bank, CreditTransaction
from ..serializers import UserSerializer


class BankSupportView(APIView):
    """
    Bank support credits endpoint.
    
    Rules:
    - 0 credits → give 6 credits
    - 1-2 credits → give 4 credits
    - 3 credits → give 2 credits
    - >3 credits → not eligible
    - Can only request once per 24 hours
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Check eligibility for support credits."""
        user = request.user
        eligibility = self._check_eligibility(user)
        
        return Response({
            'eligible': eligibility['eligible'],
            'reason': eligibility['reason'],
            'support_amount': eligibility['amount'],
            'current_credits': float(user.credits),
            'cooldown_ends': eligibility.get('cooldown_ends'),
        })
    
    def post(self, request):
        """Request support credits from the bank."""
        user = request.user
        eligibility = self._check_eligibility(user)
        
        if not eligibility['eligible']:
            return Response(
                {'error': eligibility['reason']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        support_amount = Decimal(str(eligibility['amount']))
        
        # Record support transaction
        CreditTransaction.record_transaction(
            user=user,
            amount=support_amount,
            transaction_type='SUPPORT',
            description='Bank support credits'
        )
        
        # Deduct from bank
        bank = Bank.get_instance()
        bank.deduct_credits(support_amount)
        
        # Update last support request time
        user.last_support_request = timezone.now()
        user.save(update_fields=['last_support_request'])
        
        return Response({
            'message': f'You received {support_amount} support credits.',
            'user': UserSerializer(user).data
        })
    
    def _check_eligibility(self, user):
        """
        Check if user is eligible for support credits.
        
        Returns dict with:
        - eligible: bool
        - reason: str
        - amount: int (support credits to give)
        - cooldown_ends: datetime (if in cooldown)
        """
        # Check cooldown period
        cooldown_hours = getattr(settings, 'SUPPORT_CREDIT_COOLDOWN_HOURS', 24)
        
        if user.last_support_request:
            cooldown_ends = user.last_support_request + timedelta(hours=cooldown_hours)
            if timezone.now() < cooldown_ends:
                return {
                    'eligible': False,
                    'reason': f'You can request support credits again after {cooldown_hours} hours.',
                    'amount': 0,
                    'cooldown_ends': cooldown_ends.isoformat(),
                }
        
        # Check credit balance and determine support amount
        current_credits = user.credits
        
        if current_credits == 0:
            return {
                'eligible': True,
                'reason': 'Eligible for maximum support.',
                'amount': 6,
            }
        elif current_credits >= 1 and current_credits <= 2:
            return {
                'eligible': True,
                'reason': 'Eligible for support credits.',
                'amount': 4,
            }
        elif current_credits == 3:
            return {
                'eligible': True,
                'reason': 'Eligible for minimal support.',
                'amount': 2,
            }
        else:
            return {
                'eligible': False,
                'reason': 'You have more than 3 credits. Not eligible for support.',
                'amount': 0,
            }
