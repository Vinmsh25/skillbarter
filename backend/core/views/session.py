from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Session, SessionTimer, CreditTransaction, Bank
from ..serializers import (
    SessionSerializer,
    SessionCreateSerializer,
    SessionTimerSerializer
)
from ..utils import calculate_credits


class SessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for learning sessions.
    
    Endpoints:
    - GET /sessions/ - List user's sessions
    - POST /sessions/ - Create a new session
    - GET /sessions/{id}/ - Get session details
    - POST /sessions/{id}/timer/start/ - Start teaching timer
    - POST /sessions/{id}/timer/stop/ - Stop teaching timer
    - POST /sessions/{id}/end/ - End session and process credits
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return sessions where user is a participant."""
        user = self.request.user
        return Session.objects.filter(
            user1=user
        ) | Session.objects.filter(
            user2=user
        )
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SessionCreateSerializer
        return SessionSerializer
    
    @action(detail=True, methods=['post'], url_path='timer/start')
    def start_timer(self, request, pk=None):
        """
        Start teaching timer for the current user.
        Only one timer can run at a time in a session.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if session is active
        if not session.is_active:
            return Response(
                {'error': 'Session is not active.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if there's already a running timer
        active_timer = session.get_active_timer()
        if active_timer:
            if active_timer.teacher == user:
                return Response(
                    {'error': 'Your timer is already running.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Stop the other user's timer first
            active_timer.stop()
        
        # Start new timer
        timer = SessionTimer.start_timer(session, user)
        
        return Response({
            'message': 'Timer started.',
            'timer': SessionTimerSerializer(timer).data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='timer/stop')
    def stop_timer(self, request, pk=None):
        """
        Stop the current user's teaching timer.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Find running timer for this user
        active_timer = session.get_active_timer()
        
        if not active_timer:
            return Response(
                {'error': 'No active timer to stop.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if active_timer.teacher != user:
            return Response(
                {'error': 'You can only stop your own timer.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Stop timer
        active_timer.stop()
        
        return Response({
            'message': 'Timer stopped.',
            'timer': SessionTimerSerializer(active_timer).data
        })
    
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """
        End the session and process credit transfers.
        Credits are transferred based on teaching time.
        Bank takes 10% cut from each transfer.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if session is already ended
        if not session.is_active:
            return Response(
                {'error': 'Session is already ended.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # End session (this also stops any running timers)
        session.end_session()
        
        # Calculate and transfer credits
        credit_summary = self._process_credit_transfers(session)
        
        return Response({
            'message': 'Session ended.',
            'session': SessionSerializer(session).data,
            'credit_summary': credit_summary
        })
    
    def _process_credit_transfers(self, session):
        """
        Process credit transfers based on teaching time.
        5 minutes teaching = 1 credit
        Bank takes 10% cut from teacher earnings.
        """
        from django.db import transaction
        
        user1_teaching_seconds = session.get_teaching_time(session.user1)
        user2_teaching_seconds = session.get_teaching_time(session.user2)
        
        credit_summary = {
            'user1': {
                'id': session.user1.id,
                'name': session.user1.name,
                'teaching_seconds': user1_teaching_seconds,
                'credits_earned': 0,
                'credits_spent': 0,
            },
            'user2': {
                'id': session.user2.id,
                'name': session.user2.name,
                'teaching_seconds': user2_teaching_seconds,
                'credits_earned': 0,
                'credits_spent': 0,
            },
            'bank_cut': 0
        }
        
        bank = Bank.get_instance()
        
        with transaction.atomic():
            # User1 taught, User2 learns
            if user1_teaching_seconds > 0:
                credits_needed = calculate_credits(user1_teaching_seconds)
                
                # Check learner (user2) balance
                learner_balance = session.user2.credits
                actual_credits = min(credits_needed, learner_balance)
                
                if actual_credits > 0:
                    bank_cut = actual_credits * Decimal('0.10')
                    teacher_receives = actual_credits - bank_cut
                    
                    # Deduct from learner (user2)
                    CreditTransaction.record_transaction(
                        user=session.user2,
                        amount=-actual_credits,
                        transaction_type='LEARNING',
                        session=session,
                        description=f'Learning from {session.user1.name}'
                    )
                    credit_summary['user2']['credits_spent'] = float(actual_credits)
                    
                    # Add to teacher (user1) - minus bank cut
                    CreditTransaction.record_transaction(
                        user=session.user1,
                        amount=teacher_receives,
                        transaction_type='TEACHING',
                        session=session,
                        description=f'Teaching {session.user2.name}'
                    )
                    credit_summary['user1']['credits_earned'] = float(teacher_receives)
                    
                    # Bank takes cut
                    bank.add_credits(bank_cut)
                    credit_summary['bank_cut'] += float(bank_cut)
            
            # User2 taught, User1 learns
            if user2_teaching_seconds > 0:
                credits_needed = calculate_credits(user2_teaching_seconds)
                
                # Check learner (user1) balance
                learner_balance = session.user1.credits
                actual_credits = min(credits_needed, learner_balance)
                
                if actual_credits > 0:
                    bank_cut = actual_credits * Decimal('0.10')
                    teacher_receives = actual_credits - bank_cut
                    
                    # Deduct from learner (user1)
                    CreditTransaction.record_transaction(
                        user=session.user1,
                        amount=-actual_credits,
                        transaction_type='LEARNING',
                        session=session,
                        description=f'Learning from {session.user2.name}'
                    )
                    credit_summary['user1']['credits_spent'] = float(actual_credits)
                    
                    # Add to teacher (user2) - minus bank cut
                    CreditTransaction.record_transaction(
                        user=session.user2,
                        amount=teacher_receives,
                        transaction_type='TEACHING',
                        session=session,
                        description=f'Teaching {session.user1.name}'
                    )
                    credit_summary['user2']['credits_earned'] = float(teacher_receives)
                    
                    # Bank takes cut
                    bank.add_credits(bank_cut)
                    credit_summary['bank_cut'] += float(bank_cut)
        
        return credit_summary
