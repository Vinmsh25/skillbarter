from django.db import models
from django.conf import settings


class LearningRequestPost(models.Model):
    """
    Learning Request Post model.
    Users create posts when they want to learn something.
    No fixed skills - every search creates a new post.
    """
    
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='learning_posts'
    )
    topic_to_learn = models.CharField(
        max_length=255,
        help_text='Topic the user wants to learn'
    )
    topic_to_teach = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Topic the user can teach in exchange (optional)'
    )
    ok_with_just_learning = models.BooleanField(
        default=False,
        help_text='User is okay with just learning (paying credits)'
    )
    bounty_enabled = models.BooleanField(
        default=False,
        help_text='User is willing to pay extra credits as bounty'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(
        default=False,
        help_text='Whether this learning request has been fulfilled'
    )
    
    class Meta:
        verbose_name = 'learning request post'
        verbose_name_plural = 'learning request posts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_completed', '-created_at']),
            models.Index(fields=['creator', 'is_completed']),
        ]
    
    def __str__(self):
        return f"{self.creator.name} wants to learn: {self.topic_to_learn}"
    
    @classmethod
    def get_active_posts(cls):
        """Return all active (not completed) posts."""
        return cls.objects.filter(is_completed=False)
    
    def mark_completed(self):
        """Mark this post as completed."""
        self.is_completed = True
        self.save(update_fields=['is_completed'])
