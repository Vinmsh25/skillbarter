from django.db import models
from django.conf import settings

class ChatMessage(models.Model):
    """
    Stores chat messages for a session.
    """
    session = models.ForeignKey(
        'Session',
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']
        
    def __str__(self):
        return f"{self.sender.name}: {self.message[:20]}..."
