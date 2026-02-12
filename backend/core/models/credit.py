from django.db import models
from django.conf import settings
from decimal import Decimal


class Bank(models.Model):
    """
    System Bank model.
    Accumulates 10% cut from all teaching transactions.
    No fixed balance - grows from transaction cuts.
    Singleton pattern - only one bank instance.
    """
    
    total_credits = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Total credits accumulated from transaction cuts'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'bank'
        verbose_name_plural = 'bank'
    
    def __str__(self):
        return f"Bank (Total: {self.total_credits} credits)"
    
    @classmethod
    def get_instance(cls):
        """Get or create the singleton bank instance."""
        bank, _ = cls.objects.get_or_create(pk=1)
        return bank
    
    def add_credits(self, amount):
        """Add credits to the bank (from transaction cuts)."""
        self.total_credits += Decimal(str(amount))
        self.save(update_fields=['total_credits', 'updated_at'])
    
    def deduct_credits(self, amount):
        """Deduct credits from bank (for support payouts)."""
        amount = Decimal(str(amount))
        if self.total_credits < amount:
            raise ValueError('Insufficient bank credits.')
        self.total_credits -= amount
        self.save(update_fields=['total_credits', 'updated_at'])


class CreditTransaction(models.Model):
    """
    Credit Transaction model for audit trail.
    Tracks all credit movements in the system.
    """
    
    TRANSACTION_TYPES = [
        ('TEACHING', 'Teaching Earned'),
        ('LEARNING', 'Learning Spent'),
        ('SIGNUP', 'Signup Bonus'),
        ('SUPPORT', 'Bank Support'),
        ('BANK_CUT', 'Bank Cut'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions'
    )
    session = models.ForeignKey(
        'Session',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credit_transactions'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Positive for earned, negative for spent'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES
    )
    balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='User balance after this transaction'
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'credit transaction'
        verbose_name_plural = 'credit transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.name}: {self.amount:+.2f} ({self.transaction_type})"
    
    @classmethod
    def record_transaction(cls, user, amount, transaction_type, session=None, description=''):
        """Record a credit transaction and update user balance."""
        from django.db import transaction as db_transaction
        
        with db_transaction.atomic():
            # Update user credits
            new_balance = user.credits + Decimal(str(amount))
            if new_balance < 0:
                raise ValueError('Insufficient credits.')
            user.credits = new_balance
            user.save(update_fields=['credits'])
            
            # Create transaction record
            return cls.objects.create(
                user=user,
                session=session,
                amount=Decimal(str(amount)),
                transaction_type=transaction_type,
                balance_after=user.credits,
                description=description
            )
