"""Encrypted local keystore (AES-256-GCM, scrypt KDF).

Cross-compatible with the TypeScript SDK keystore format (same salt/iv/ct/tag
fields and scrypt params), so a keystore made by one SDK opens in the other.
The private key NEVER leaves the machine and is NEVER sent to AceChange.

WARNING: a real, fund-holding wallet must be independently audited before
production. This is the open-source reference implementation.
"""
from __future__ import annotations
import hashlib
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_N, _R, _P = 1 << 15, 8, 1  # scrypt params (match the TS SDK)


def _derive(passphrase: str, salt: bytes) -> bytes:
    return hashlib.scrypt(passphrase.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=32)


def encrypt_private_key(private_key_hex: str, passphrase: str) -> dict:
    salt, iv = os.urandom(16), os.urandom(12)
    key = _derive(passphrase, salt)
    pk = bytes.fromhex(private_key_hex[2:] if private_key_hex.startswith("0x") else private_key_hex)
    sealed = AESGCM(key).encrypt(iv, pk, None)  # ciphertext || 16-byte tag
    ct, tag = sealed[:-16], sealed[-16:]
    return {"v": 1, "kdf": "scrypt", "salt": salt.hex(), "iv": iv.hex(), "ct": ct.hex(), "tag": tag.hex()}


def decrypt_private_key(blob: dict, passphrase: str) -> str:
    key = _derive(passphrase, bytes.fromhex(blob["salt"]))
    sealed = bytes.fromhex(blob["ct"]) + bytes.fromhex(blob["tag"])
    pt = AESGCM(key).decrypt(bytes.fromhex(blob["iv"]), sealed, None)
    return "0x" + pt.hex()


def save_keystore(path: str, blob: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(blob, f)
    os.chmod(path, 0o600)


def load_keystore(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
