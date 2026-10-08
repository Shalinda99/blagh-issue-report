"""
Unit tests for app/core/security.py
Covers: password hashing, JWT creation/decoding, and the get_current_admin dependency.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.config import settings
from app.core.security import (
    create_access_token,
    decode_token,
    get_current_admin,
    hash_password,
    verify_password,
)


# ─── Password utilities ───────────────────────────────────────────────────────

def test_hash_password_returns_non_plain():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    assert len(hashed) > 10


def test_hash_password_different_each_call():
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2  # bcrypt uses random salt


def test_verify_password_correct():
    hashed = hash_password("correct_horse")
    assert verify_password("correct_horse", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("correct_horse")
    assert verify_password("wrong_password", hashed) is False


def test_verify_password_empty_string():
    hashed = hash_password("secret")
    assert verify_password("", hashed) is False


# ─── JWT creation / decoding ──────────────────────────────────────────────────

def test_create_access_token_returns_string():
    token = create_access_token("user@test.com")
    assert isinstance(token, str)
    assert token.count(".") == 2  # header.payload.signature


def test_create_access_token_sub_claim():
    token = create_access_token("user@test.com")
    payload = decode_token(token)
    assert payload["sub"] == "user@test.com"


def test_create_access_token_non_string_subject():
    token = create_access_token(12345)
    payload = decode_token(token)
    assert payload["sub"] == "12345"


def test_create_access_token_has_exp_and_iat():
    token = create_access_token("u@test.com")
    payload = decode_token(token)
    assert "exp" in payload
    assert "iat" in payload


def test_create_access_token_custom_expiry():
    token = create_access_token("u@test.com", expires_delta=timedelta(hours=2))
    payload = decode_token(token)
    expected_exp = datetime.now(timezone.utc) + timedelta(hours=2)
    # Allow 5 seconds tolerance
    assert abs(payload["exp"] - expected_exp.timestamp()) < 5


def test_decode_token_invalid_signature_raises():
    token = create_access_token("u@test.com")
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_token(tampered)


def test_decode_token_garbage_raises():
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_token("not.a.real.jwt")


def test_decode_token_expired_raises():
    token = create_access_token("u@test.com", expires_delta=timedelta(seconds=-1))
    with pytest.raises(ValueError):
        decode_token(token)


def test_decode_token_missing_sub_returns_payload():
    """decode_token itself does not validate sub — that is done in get_current_admin."""
    payload_data = {
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    payload = decode_token(token)
    assert "sub" not in payload


# ─── get_current_admin dependency ─────────────────────────────────────────────

def test_get_current_admin_no_credentials_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        get_current_admin(credentials=None)
    assert exc_info.value.status_code == 401
    assert "WWW-Authenticate" in exc_info.value.headers


def test_get_current_admin_valid_token_returns_payload():
    token = create_access_token("admin@test.com")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    payload = get_current_admin(credentials=creds)
    assert payload["sub"] == "admin@test.com"


def test_get_current_admin_invalid_token_raises_401():
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad.token.here")
    with pytest.raises(HTTPException) as exc_info:
        get_current_admin(credentials=creds)
    assert exc_info.value.status_code == 401


def test_get_current_admin_expired_token_raises_401():
    token = create_access_token("admin@test.com", expires_delta=timedelta(seconds=-1))
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_admin(credentials=creds)
    assert exc_info.value.status_code == 401


def test_get_current_admin_missing_sub_raises_401():
    """JWT without a sub claim must be rejected (validates Fix #5)."""
    payload_data = {
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_admin(credentials=creds)
    assert exc_info.value.status_code == 401
    assert "required claims" in exc_info.value.detail
