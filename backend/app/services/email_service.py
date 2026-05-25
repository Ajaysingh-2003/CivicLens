import resend
from app.core.config import settings

# Initialize Resend
resend.api_key = settings.RESEND_API_KEY

def send_otp_email(to_email: str, otp_code: str, purpose: str):
    """
    Sends an OTP code via email using Resend.
    Purpose should be 'register' or 'login'.
    """
    if purpose == "register":
        subject = "Verify your CivicLens Account"
    elif purpose == "forgot_password":
        subject = "Reset Your CivicLens Password"
    else:
        subject = "Your CivicLens Login Code"
    
    purpose_label = "reset your password" if purpose == "forgot_password" else purpose
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4CAF50; text-align: center;">CivicLens</h2>
        <p>Hello,</p>
        <p>Your one-time password (OTP) to {purpose_label} is:</p>
        <h1 style="text-align: center; letter-spacing: 5px; color: #333; background: #f4f4f4; padding: 10px; border-radius: 5px;">{otp_code}</h1>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
    </div>
    """
    
    try:
        # Note: If you have a verified domain, replace 'onboarding@resend.dev' with 'no-reply@yourdomain.com'
        # Resend's free tier allows testing with onboarding@resend.dev but only to your own registered email.
        response = resend.Emails.send({
            "from": "CivicLens <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
