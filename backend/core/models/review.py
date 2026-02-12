from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Review(models.Model):
    """
    Review model for session feedback.
    Users can review each other after a session.
    """
    
    session = models.ForeignKey(
        'Session',
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_given'
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_received'
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Rating from 1 to 5'
    )
    comment = models.TextField(
        blank=True,
        default='',
        help_text='Optional review comment'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'review'
        verbose_name_plural = 'reviews'
        ordering = ['-created_at']
        unique_together = ['session', 'reviewer']  # One review per user per session
        indexes = [
            models.Index(fields=['reviewee', '-created_at']),
        ]
    
    def __str__(self):
        return f"Review: {self.reviewer.name} -> {self.reviewee.name} ({self.rating}/5)"
