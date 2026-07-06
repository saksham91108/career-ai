import smtplib
import secrets
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)


class EmailService:

    def __init__(self):
        self.gmail_user = os.environ.get("GMAIL_USER")
        self.gmail_password = os.environ.get("GMAIL_APP_PASSWORD")

    def generate_otp(self) -> str:
        return str(secrets.randbelow(900000) + 100000)

    def send_otp(self, to_email: str, otp: str) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Your CareerAI Verification Code"
            msg["From"] = self.gmail_user
            msg["To"] = to_email

            html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px;">
                <div style="max-width: 480px; margin: auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
                    <h2 style="color: #818cf8; margin-bottom: 8px;">CareerAI</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Resume Intelligence Platform</p>
                    <hr style="border-color: #334155; margin: 24px 0;">
                    <p style="font-size: 16px; color: #e2e8f0;">Your verification code is:</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <span style="font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #818cf8; font-family: monospace;">
                            {otp}
                        </span>
                    </div>
                    <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
                    <hr style="border-color: #334155; margin: 24px 0;">
                    <p style="color: #475569; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(self.gmail_user, self.gmail_password)
                server.sendmail(self.gmail_user, to_email, msg.as_string())

            logger.info(f"OTP sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send OTP to {to_email}: {str(e)}")
            return False