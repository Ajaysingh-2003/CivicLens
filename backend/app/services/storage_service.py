import boto3
from botocore.exceptions import NoCredentialsError
from botocore.client import Config
from fastapi import UploadFile, HTTPException
import uuid
import datetime
from app.core.config import settings

# Initialize boto3 S3 client configured for Cloudflare R2
s3_client = boto3.client(
    's3',
    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
    region_name="auto", # Required for boto3 but R2 handles regions automatically
    config=Config(s3={'addressing_style': 'path'})
)

def upload_avatar(file: UploadFile, user_id: int) -> str:
    """
    Uploads an avatar image to Cloudflare R2 with a dynamic name.
    Returns the public URL of the uploaded image.
    """
    if not settings.R2_BUCKET_NAME or not settings.R2_PUBLIC_URL:
        raise HTTPException(status_code=500, detail="Storage configuration missing")

    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG and PNG are allowed.")

    # Generate a unique filename using timestamp to prevent caching issues across devices
    timestamp = int(datetime.datetime.now().timestamp())
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    object_key = f"avatars/{user_id}_{timestamp}.{file_extension}"

    try:
        # Read file contents
        file_content = file.file.read()
        
        # Validate size (5MB max)
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

        s3_client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_key,
            Body=file_content,
            ContentType=file.content_type
        )
        
        # Return the public URL
        # Ensure R2_PUBLIC_URL does not end with a slash, to avoid double slashes
        base_url = settings.R2_PUBLIC_URL.rstrip('/')
        return f"{base_url}/{object_key}"

    except NoCredentialsError:
        raise HTTPException(status_code=500, detail="Storage credentials not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """
    Generic file upload to Cloudflare R2.
    """
    if not settings.R2_BUCKET_NAME or not settings.R2_PUBLIC_URL:
        raise HTTPException(status_code=500, detail="Storage configuration missing")

    try:
        s3_client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=filename,
            Body=file_bytes,
            ContentType=content_type
        )
        
        base_url = settings.R2_PUBLIC_URL.rstrip('/')
        return f"{base_url}/{filename}"

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

def delete_avatar(avatar_url: str):
    """
    Deletes the avatar object from Cloudflare R2 given its public URL.
    """
    if not settings.R2_BUCKET_NAME or not settings.R2_PUBLIC_URL:
        return

    try:
        # Extract the object key from the public URL
        base_url = settings.R2_PUBLIC_URL.rstrip('/')
        if avatar_url.startswith(base_url):
            object_key = avatar_url[len(base_url) + 1:] # +1 to skip the slash
            s3_client.delete_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=object_key
            )
    except Exception as e:
        # Log error, but don't crash if delete fails
        print(f"Failed to delete old avatar: {e}")
