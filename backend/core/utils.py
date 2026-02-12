from decimal import Decimal


def calculate_credits(teaching_seconds: int) -> Decimal:
    """
    Calculate credits earned from teaching time.
    
    Rule: 5 minutes teaching = 1 credit
    
    Args:
        teaching_seconds: Total teaching time in seconds
    
    Returns:
        Decimal: Credits earned (rounded to 2 decimal places)
    """
    if teaching_seconds <= 0:
        return Decimal('0.00')
    
    minutes = Decimal(str(teaching_seconds)) / Decimal('60')
    credits = minutes / Decimal('5')
    
    return credits.quantize(Decimal('0.01'))


def format_duration(seconds: int) -> str:
    """
    Format duration in human-readable format.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        str: Formatted duration (e.g., "1h 30m 45s")
    """
    if seconds <= 0:
        return "0s"
    
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if secs > 0 or not parts:
        parts.append(f"{secs}s")
    
    return " ".join(parts)
