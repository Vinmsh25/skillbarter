from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from decimal import Decimal


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""
    
    def create_user(self, email, name, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('Users must have an email address')
        
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        
        # New users get 15 credits on signup
        if 'credits' not in extra_fields:
            user.credits = Decimal('15.00')
        
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, name, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model for Link & Learn.
    Uses email as the unique identifier instead of username.
    """
    
    email = models.EmailField(
        verbose_name='email address',
        max_length=255,
        unique=True,
    )
    name = models.CharField(max_length=150, unique=True)
    credits = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('15.00'),  # New users get 15 credits
        help_text='User credit balance'
    )
    is_online = models.BooleanField(
        default=False,
        help_text='Whether user is currently online'
    )
    availability = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text='User availability (e.g., "Mon-Fri 9am-5pm")'
    )
    
    # Support credit tracking
    last_support_request = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last time user requested support credits'
    )
    
    # Standard Django user fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    
    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ['-date_joined']
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return self.name
    
    def get_short_name(self):
        return self.name.split()[0] if self.name else self.email
    
    @property
    def average_rating(self):
        """Calculate average rating from received reviews."""
        from .review import Review
        reviews = Review.objects.filter(reviewee=self)
        if not reviews.exists():
            return None
        return reviews.aggregate(models.Avg('rating'))['rating__avg']
    
    @property
    def total_reviews(self):
        """Count of received reviews."""
        from .review import Review
        return Review.objects.filter(reviewee=self).count()
