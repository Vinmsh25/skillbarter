from datetime import datetime
from channels.db import database_sync_to_async
from .base import BaseConsumer


class ChatConsumer(BaseConsumer):
    """
    WebSocket consumer for chat messaging within a session.
    
    - Send messages to session participants
    - Real-time message delivery
    - Typing indicators
    
    Group: 'chat_{session_id}'
    URL: ws/chat/{session_id}/
    """
    
    async def get_groups(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.chat_group = f'chat_{self.session_id}'
        
        # Verify user is session participant
        is_participant = await self.verify_session_participant()
        if not is_participant:
            await self.close(code=4003)
            return []
        
        return [self.chat_group]
    
    async def on_connected(self):
        """Notify other participant that user joined chat and send history."""
        user_data = await self.get_user_data(self.user)
        
        # Send recent chat history to the user
        await self.send_chat_history()
        
        await self.broadcast_to_group(
            self.chat_group,
            'user_joined',
            {'user': user_data}
        )
    
    @database_sync_to_async
    def get_chat_history(self):
        """Fetch recent chat messages for this session."""
        from ..models import ChatMessage
        # Get LAST 50 messages (newest), then reverse to show in chronological order
        messages = ChatMessage.objects.filter(session_id=self.session_id).order_by('-timestamp')[:50]
        history = [
            {
                'sender': msg.sender.name,
                'message': msg.message,
                'timestamp': msg.timestamp.isoformat()
            }
            for msg in messages
        ]
        return history[::-1] # Reverse to chronological order

    async def send_chat_history(self):
        """Send chat history to the connected user."""
        history = await self.get_chat_history()
        for msg in history:
            await self.send_json({
                'type': 'chat_message',
                'sender': msg['sender'],
                'message': msg['message'],
                'timestamp': msg['timestamp']
            })

    async def on_disconnected(self):
        """Notify other participant that user left chat."""
        if not hasattr(self, 'chat_group'):
            return

        user_data = await self.get_user_data(self.user)
        
        await self.broadcast_to_group(
            self.chat_group,
            'user_left',
            {'user': user_data}
        )
    
    async def handle_chat_message(self, data):
        """Handle incoming chat message."""
        # Fix: Frontend sends 'message', not 'content'
        message = data.get('message', '').strip()
        
        if not message:
            return
        
        user_data = await self.get_user_data(self.user)
        
        # Save message to DB
        await self.save_message(self.user, message)
        
        # Broadcast message to all participants
        await self.broadcast_to_group(
            self.chat_group,
            'chat_message',
            {
                'sender': user_data['name'], # Frontend expects sender name string
                'message': message,
                'timestamp': datetime.utcnow().isoformat()
            }
        )

    @database_sync_to_async
    def save_message(self, user, message):
        """Save chat message to database."""
        from ..models import ChatMessage
        ChatMessage.objects.create(
            session_id=self.session_id,
            sender=user,
            message=message
        )
    
    async def handle_typing(self, data):
        """Handle typing indicator."""
        is_typing = data.get('is_typing', False)
        user_data = await self.get_user_data(self.user)
        
        await self.broadcast_to_group(
            self.chat_group,
            'typing_indicator',
            {
                'user': user_data,
                'is_typing': is_typing
            }
        )
    
    # Group message handlers
    async def user_joined(self, event):
        """Handle user joined broadcast."""
        await self.send_json({
            'type': 'user_joined',
            'user': event['user']
        })
    
    async def user_left(self, event):
        """Handle user left broadcast."""
        await self.send_json({
            'type': 'user_left',
            'user': event['user']
        })
    
    async def chat_message(self, event):
        """Handle chat message broadcast."""
        await self.send_json({
            'type': 'chat_message', # Fix: Frontend expects 'chat_message'
            'sender': event['sender'],
            'message': event['message'], # Fix: Frontend expects 'message'
            'timestamp': event['timestamp']
        })
    
    async def typing_indicator(self, event):
        """Handle typing indicator broadcast."""
        # Don't send typing indicator to the user who is typing
        if event['user']['id'] != self.user.id:
            await self.send_json({
                'type': 'typing',
                'user': event['user'],
                'is_typing': event['is_typing']
            })
    
    @database_sync_to_async
    def verify_session_participant(self):
        """Verify user is a participant in the session."""
        from ..models import Session
        
        try:
            session = Session.objects.get(pk=self.session_id)
            return self.user in [session.user1, session.user2]
        except Session.DoesNotExist:
            return False
