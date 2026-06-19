"""acechange-agent-wallet — non-custodial wallet for AI agents (Python port).

Mirrors @acechange/agent-wallet (TypeScript). Keys live with the bot; AceChange
never custodies. See README + docs/AGENT-WALLET-SPEC.md.
"""
from .wallet import AgentWallet
from .acechange import AceChangeAgent
from .policy import Policy
from .keystore import encrypt_private_key, decrypt_private_key, save_keystore, load_keystore
from .zerox import sign_gasless_quote

__all__ = [
    "AgentWallet", "AceChangeAgent", "Policy",
    "encrypt_private_key", "decrypt_private_key", "save_keystore", "load_keystore",
    "sign_gasless_quote",
]
__version__ = "0.1.0"
