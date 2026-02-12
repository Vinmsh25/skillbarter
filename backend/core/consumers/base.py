import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class BaseConsumer(AsyncWebsocketConsumer):
    """
    Base WebSocket consumer with common functionality.
    Handles authentication and group management.
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user', AnonymousUser())
        
        # Reject unauthenticated connections
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        # Set up groups (to be overridden by subclasses)
        self.groups_to_join = await self.get_groups()
        
        # Join groups
        for group in self.groups_to_join:
            await self.channel_layer.group_add(group, self.channel_name)
        
        await self.accept()
        
        # Call connected hook
        await self.on_connected()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Leave groups
        for group in getattr(self, 'groups_to_join', []):
            await self.channel_layer.group_discard(group, self.channel_name)
        
        # Call disconnected hook
        await self.on_disconnected()
    
    async def receive(self, text_data):
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            # Route to handler method
            handler = getattr(self, f'handle_{message_type}', None)
            if handler:
                await handler(data)
            else:
                await self.send_error(f'Unknown message type: {message_type}')
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON')
        except Exception as e:
            await self.send_error(str(e))
    
    async def get_groups(self):
        """Return list of groups to join. Override in subclasses."""
        return []
    
    async def on_connected(self):
        """Hook called after successful connection. Override in subclasses."""
        pass
    
    async def on_disconnected(self):
        """Hook called after disconnection. Override in subclasses."""
        pass
    
    async def send_json(self, data):
        """Send JSON data to the WebSocket."""
        await self.send(text_data=json.dumps(data))
    
    async def send_error(self, message):
        """Send error message to the WebSocket."""
        await self.send_json({
            'type': 'error',
            'message': message
        })
    
    async def broadcast_to_group(self, group, message_type, data):
        """Broadcast message to a group."""
        await self.channel_layer.group_send(group, {
            'type': message_type,
            **data
        })
    
    @database_sync_to_async
    def get_user_data(self, user):
        """Get serializable user data."""
        if not user or not user.is_authenticated:
            return None
            
        return {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'is_online': user.is_online,
            'availability': getattr(user, 'availability', None),
        }
