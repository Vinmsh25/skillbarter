from datetime import datetime
from channels.db import database_sync_to_async
from .base import BaseConsumer


class SessionConsumer(BaseConsumer):
    """
    WebSocket consumer for session timer sync and credit updates.
    
    - Timer start/stop events (broadcast to both participants)
    - Credit balance updates
    - Session end notifications
    
    Group: 'session_{session_id}'
    URL: ws/session/{session_id}/
    """
    
    async def get_groups(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.session_group = f'session_{self.session_id}'
        
        # Verify user is session participant
        is_participant = await self.verify_session_participant()
        if not is_participant:
            await self.close(code=4003)
            return []
        
        return [self.session_group]
    
    async def on_connected(self):
        """Send current session state to connected user."""
        session_data = await self.get_session_data()
        
        await self.send_json({
            'type': 'session_state',
            'session': session_data
        })
    
    async def handle_timer_start(self, data):
        """Handle timer start request."""
        result = await self.start_timer()
        
        if result['success']:
            await self.broadcast_to_group(
                self.session_group,
                'timer_started',
                {
                    'teacher_id': self.user.id,
                    'teacher_name': self.user.name,
                    'start_time': result['start_time'],
                    'timer_id': result['timer_id']
                }
            )
        else:
            await self.send_error(result['error'])
    
    async def handle_timer_stop(self, data):
        """Handle timer stop request."""
        result = await self.stop_timer()
        
        if result['success']:
            await self.broadcast_to_group(
                self.session_group,
                'timer_stopped',
                {
                    'teacher_id': self.user.id,
                    'teacher_name': self.user.name,
                    'end_time': result['end_time'],
                    'duration_seconds': result['duration_seconds'],
                    'timer_id': result['timer_id'],
                    'new_total_time': result['new_total_time']
                }
            )
        else:
            await self.send_error(result['error'])
    
    async def handle_end_session(self, data):
        """Handle session end request."""
        result = await self.end_session()
        
        if result['success']:
            await self.broadcast_to_group(
                self.session_group,
                'session_ended',
                {
                    'ended_by': self.user.id,
                    'credit_summary': result['credit_summary']
                }
            )
        else:
            await self.send_error(result['error'])
    
    async def handle_get_credits(self, data):
        """Handle request for current credit balances."""
        credits = await self.get_user_credits()
        
        await self.send_json({
            'type': 'credit_balance',
            'credits': credits
        })

    async def handle_signal(self, data):
        """Handle WebRTC signaling messages."""
        payload = data.get('payload', {})
        
        await self.broadcast_to_group(
            self.session_group,
            'signal_message',
            {
                'sender': self.user.id,
                'payload': payload
            }
        )

    async def handle_whiteboard_update(self, data):
        """Handle whiteboard drawing updates."""
        update_data = data.get('data', {})
        
        await self.broadcast_to_group(
            self.session_group,
            'whiteboard_update_broadcast',
            {
                'sender': self.user.id,
                'data': update_data
            }
        )

    async def handle_code_update(self, data):
        """Handle code/IDE editor updates."""
        update_data = data.get('data', {})
        
        await self.broadcast_to_group(
            self.session_group,
            'code_update_broadcast',
            {
                'sender': self.user.id,
                'data': update_data
            }
        )

    # Group message handlers
    async def code_update_broadcast(self, event):
        """Handle code broadcast."""
        # Don't echo back to sender
        if event['sender'] == self.user.id:
            return
            
        await self.send_json({
            'type': 'code_update',
            'data': event['data']
        })

    async def whiteboard_update_broadcast(self, event):
        """Handle whiteboard broadcast."""
        # Don't echo back to sender
        if event['sender'] == self.user.id:
            return
            
        await self.send_json({
            'type': 'whiteboard_update',
            'data': event['data']
        })

    async def signal_message(self, event):
        """Handle signal broadcast."""
        # Don't echo back to sender
        if event['sender'] == self.user.id:
            return
            
        await self.send_json({
            'type': 'signal',
            'payload': event['payload']
        })

    async def timer_started(self, event):
        """Handle timer started broadcast."""
        await self.send_json({
            'type': 'timer_started',
            'teacher_id': event['teacher_id'],
            'teacher_name': event['teacher_name'],
            'start_time': event['start_time'],
            'timer_id': event['timer_id']
        })
    
    async def timer_stopped(self, event):
        """Handle timer stopped broadcast."""
        await self.send_json({
            'type': 'timer_stopped',
            'teacher_id': event['teacher_id'],
            'teacher_name': event['teacher_name'],
            'end_time': event['end_time'],
            'duration_seconds': event['duration_seconds'],
            'timer_id': event['timer_id'],
            'new_total_time': event.get('new_total_time')
        })
    
    async def session_ended(self, event):
        """Handle session ended broadcast."""
        # Get updated credit balance for this user
        credits = await self.get_user_credits()
        
        await self.send_json({
            'type': 'session_ended',
            'ended_by': event['ended_by'],
            'credit_summary': event['credit_summary'],
            'your_credits': credits
        })
    
    async def credit_update(self, event):
        """Handle credit update broadcast."""
        await self.send_json({
            'type': 'credit_update',
            'user_id': event['user_id'],
            'new_balance': event['new_balance']
        })
    
    @database_sync_to_async
    def verify_session_participant(self):
        """Verify user is a participant in the session."""
        from ..models import Session
        
        try:
            self.session = Session.objects.get(pk=self.session_id)
            return self.user in [self.session.user1, self.session.user2]
        except Session.DoesNotExist:
            return False
    
    @database_sync_to_async
    def get_session_data(self):
        """Get current session data."""
        from ..models import Session
        from ..serializers import SessionSerializer
        
        session = Session.objects.get(pk=self.session_id)
        return SessionSerializer(session).data
    
    @database_sync_to_async
    def start_timer(self):
        """Start teaching timer for current user."""
        from ..models import Session, SessionTimer
        
        session = Session.objects.get(pk=self.session_id)
        
        if not session.is_active:
            return {'success': False, 'error': 'Session is not active'}
        
        # Check if there's already a running timer
        active_timer = session.get_active_timer()
        if active_timer:
            if active_timer.teacher == self.user:
                return {'success': False, 'error': 'Your timer is already running'}
            return {'success': False, 'error': f'Session is currently locked by {active_timer.teacher.name}'}
        
        # Start new timer
        timer = SessionTimer.start_timer(session, self.user)
        
        return {
            'success': True,
            'timer_id': timer.id,
            'start_time': timer.start_time.isoformat()
        }
    
    @database_sync_to_async
    def stop_timer(self):
        """Stop current user's teaching timer."""
        from ..models import Session
        
        session = Session.objects.get(pk=self.session_id)
        active_timer = session.get_active_timer()
        
        if not active_timer:
            return {'success': False, 'error': 'No active timer to stop'}
        
        # Enforce exclusive control
        if active_timer.teacher != self.user:
           return {'success': False, 'error': 'You can only stop your own timer'}
        
        active_timer.stop()

        active_timer.stop()

        # Calculate new total teaching time - DIRECT QUERY to avoid caching
        from ..models import SessionTimer
        # Force a fresh query for all finalized timers for this user in this session
        all_timers = SessionTimer.objects.filter(session_id=self.session_id, teacher=self.user, end_time__isnull=False)
        
        # DEBUG LOGGING
        # timer_details = [f"ID:{t.id} Dur:{t.duration_seconds}" for t in all_timers]
        # print(f"DEBUG: Found timers: {timer_details}")
        
        new_total_time = sum(t.duration_seconds for t in all_timers)
        print(f"DEBUG: active_timer stopped. ID={active_timer.id}, Duration={active_timer.duration_seconds}. New Total={new_total_time}")
        
        # print(f"DEBUG: Stopped timer {active_timer.id}. Duration: {active_timer.duration_seconds}. New Total: {new_total_time}")
        
        return {
            'success': True,
            'timer_id': active_timer.id,
            'end_time': active_timer.end_time.isoformat(),
            'duration_seconds': active_timer.duration_seconds,
            'new_total_time': new_total_time
        }
    
    @database_sync_to_async
    def end_session(self):
        """End session and process credits."""
        from django.db import transaction
        from decimal import Decimal
        from ..models import Session, CreditTransaction, Bank
        from ..utils import calculate_credits
        
        session = Session.objects.get(pk=self.session_id)
        
        if not session.is_active:
            return {'success': False, 'error': 'Session is already ended'}
        
        # End session
        session.end_session()
        
        # Calculate credit transfers
        user1_teaching = session.get_teaching_time(session.user1)
        user2_teaching = session.get_teaching_time(session.user2)
        
        credit_summary = {
            'user1': {'earned': 0, 'spent': 0},
            'user2': {'earned': 0, 'spent': 0},
            'bank_cut': 0
        }
        
        bank = Bank.get_instance()
        
        with transaction.atomic():
            # User1 taught -> User2 pays
            if user1_teaching > 0:
                credits = calculate_credits(user1_teaching)
                bank_cut = credits * Decimal('0.10')
                teacher_gets = credits - bank_cut
                
                CreditTransaction.record_transaction(
                    session.user2, -credits, 'LEARNING', session,
                    f'Learning from {session.user1.name}'
                )
                CreditTransaction.record_transaction(
                    session.user1, teacher_gets, 'TEACHING', session,
                    f'Teaching {session.user2.name}'
                )
                bank.add_credits(bank_cut)
                
                credit_summary['user1']['earned'] = float(teacher_gets)
                credit_summary['user2']['spent'] = float(credits)
                credit_summary['bank_cut'] += float(bank_cut)
            
            # User2 taught -> User1 pays
            if user2_teaching > 0:
                credits = calculate_credits(user2_teaching)
                bank_cut = credits * Decimal('0.10')
                teacher_gets = credits - bank_cut
                
                CreditTransaction.record_transaction(
                    session.user1, -credits, 'LEARNING', session,
                    f'Learning from {session.user2.name}'
                )
                CreditTransaction.record_transaction(
                    session.user2, teacher_gets, 'TEACHING', session,
                    f'Teaching {session.user1.name}'
                )
                bank.add_credits(bank_cut)
                
                credit_summary['user2']['earned'] = float(teacher_gets)
                credit_summary['user1']['spent'] = float(credits)
                credit_summary['bank_cut'] += float(bank_cut)
        
        return {'success': True, 'credit_summary': credit_summary}
    
    @database_sync_to_async
    def get_user_credits(self):
        """Get current user's credit balance."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        user = User.objects.get(pk=self.user.id)
        return float(user.credits)
