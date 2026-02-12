import os
import django
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from time import sleep

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models import User, Session, SessionTimer, Bank, CreditTransaction, LearningRequestPost

def test_real_time_timer():
    print("Testing Real-time Timer...")
    u1 = User.objects.create_user(email='u1@test.com', name='U1', password='password')
    u2 = User.objects.create_user(email='u2@test.com', name='U2', password='password')
    
    session = Session.objects.create(user1=u1, user2=u2)
    timer = SessionTimer.objects.create(session=session, teacher=u1)
    
    # Wait 2 seconds
    sleep(2)
    
    teaching_time = session.get_teaching_time(u1)
    print(f"Teaching time after 2s: {teaching_time}")
    
    if teaching_time >= 2:
        print("SUCCESS: Real-time timer works.")
    else:
        print("FAILURE: Real-time timer does not include active timer.")
    
    # Cleanup
    u1.delete()
    u2.delete()

def test_credit_validation():
    print("\nTesting Credit Validation...")
    u1 = User.objects.create_user(email='u1@test.com', name='U1', password='password', credits=Decimal('1.00'))
    u2 = User.objects.create_user(email='u2@test.com', name='U2', password='password', credits=Decimal('5.00'))
    
    # u1 is learner, u2 is teacher
    session = Session.objects.create(user1=u1, user2=u2)
    
    # u2 teaches for 10 minutes (should be 2 credits)
    timer = SessionTimer.objects.create(
        session=session, 
        teacher=u2, 
        start_time=timezone.now() - timedelta(minutes=10),
        end_time=timezone.now(),
        duration_seconds=600
    )
    
    # Process transfers manually using the logic from our view
    from core.views.session import SessionViewSet
    viewset = SessionViewSet()
    summary = viewset._process_credit_transfers(session)
    
    u1.refresh_from_db()
    print(f"Learner (U1) balance after transfer: {u1.credits}")
    
    if u1.credits >= 0:
        print("SUCCESS: Learner balance is not negative.")
    else:
        print("FAILURE: Learner balance went negative.")
    
    # Cleanup
    u1.delete()
    u2.delete()

def test_bank_accounting():
    print("\nTesting Bank Accounting...")
    bank = Bank.get_instance()
    initial_credits = bank.total_credits
    
    u1 = User.objects.create_user(email='u1@test.com', name='U1', password='password')
    u1.credits = Decimal('0.00')
    u1.save()
    
    # Trigger BankSupportView.post logic manually
    support_amount = Decimal('6.00')
    bank.deduct_credits(support_amount)
    
    bank.refresh_from_db()
    final_credits = bank.total_credits
    
    print(f"Bank credits: {initial_credits} -> {final_credits}")
    
    if final_credits == initial_credits - support_amount:
        print("SUCCESS: Bank credits properly deducted.")
    else:
        print("FAILURE: Bank credits not deducted.")
    
    # Cleanup
    u1.delete()

if __name__ == "__main__":
    try:
        test_real_time_timer()
        test_credit_validation()
        test_bank_accounting()
    except Exception as e:
        print(f"Error during testing: {e}")
