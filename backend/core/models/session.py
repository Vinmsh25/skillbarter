from django.db import models
from django.conf import settings
from django.utils import timezone


class Session(models.Model):
    """
    Session model connecting two users for a learning session.
    Tracks start/end time and overall session state.
    """
    
    user1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions_as_user1'
    )
    user2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions_as_user2'
    )
    learning_request = models.ForeignKey(
        'LearningRequestPost',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'session'
        verbose_name_plural = 'sessions'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['is_active', '-start_time']),
        ]
    
    def __str__(self):
        return f"Session: {self.user1.name} <-> {self.user2.name}"
    
    @property
    def total_duration(self):
        """Calculate total session duration in seconds."""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return (timezone.now() - self.start_time).total_seconds()
    
    def get_teaching_time(self, user):
        """Get total teaching time for a specific user in this session."""
        timers = self.timers.filter(teacher=user)
        total_seconds = 0
        for timer in timers:
            if timer.end_time:
                total_seconds += timer.duration_seconds
            else:
                # Include elapsed time for running timer
                elapsed = (timezone.now() - timer.start_time).total_seconds()
                total_seconds += int(elapsed)
        return total_seconds
    
    def end_session(self):
        """End the session and stop any running timers."""
        self.is_active = False
        self.end_time = timezone.now()
        
        # Stop any running timers
        running_timers = self.timers.filter(end_time__isnull=True)
        for timer in running_timers:
            timer.stop()
        
        self.save(update_fields=['is_active', 'end_time'])
    
    def has_active_timer(self):
        """Check if there's an active timer in this session."""
        return self.timers.filter(end_time__isnull=True).exists()
    
    def get_active_timer(self):
        """Get the currently running timer, if any."""
        return self.timers.filter(end_time__isnull=True).first()


class SessionTimer(models.Model):
    """
    Per-user teaching timer within a session.
    Only one timer can run at a time per session.
    """
    
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='timers'
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teaching_timers'
    )
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(
        default=0,
        help_text='Calculated duration when timer stops'
    )
    
    class Meta:
        verbose_name = 'session timer'
        verbose_name_plural = 'session timers'
        ordering = ['-start_time']
    
    def __str__(self):
        return f"Timer: {self.teacher.name} teaching in session {self.session.id}"
    
    @property
    def is_running(self):
        """Check if this timer is currently running."""
        return self.end_time is None
    
    def stop(self):
        """Stop the timer and calculate duration."""
        if self.end_time is None:
            self.end_time = timezone.now()
            self.duration_seconds = int(
                (self.end_time - self.start_time).total_seconds()
            )
            self.save(update_fields=['end_time', 'duration_seconds'])
    
    @classmethod
    def start_timer(cls, session, teacher):
        """
        Start a new timer for a teacher in a session.
        Stops any running timer first.
        """
        # Stop any running timer in this session
        running_timer = session.get_active_timer()
        if running_timer:
            running_timer.stop()
        
        # Create new timer
        return cls.objects.create(
            session=session,
            teacher=teacher,
            start_time=timezone.now()
        )
