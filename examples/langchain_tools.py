"""LangChain adapter — expose the AceChange agent wallet as LangChain tools.

An LLM agent (via LangChain) can then `pay` and `swap` non-custodially: the
wallet signs locally, AceChange screens + builds, the bot broadcasts.

    pip install acechange-agent-wallet langchain-core
"""
import os
from langchain_core.tools import tool
from acechange_agent_wallet import AgentWallet, Policy

_wallet = AgentWallet.load(
    os.environ["WALLET_KEYSTORE"], os.environ["WALLET_PASS"],
    base_url=os.environ.get("ACECHANGE_URL", "https://www.acechange.io"),
    key_id=os.environ["ACE_AGENT_KEY"], secret=os.environ["ACE_AGENT_SECRET"],
    policy=Policy(per_tx_usd=25, daily_usd=100, allowed_tokens=["USDC", "WETH"]),
)


@tool
def pay_crypto(to: str, token: str, amount: str, est_usd: float) -> str:
    """Pay `amount` of `token` (USDC/WETH/ETH) to a Base address `to`. Non-custodial; returns the tx hash."""
    return _wallet.pay(to, token, amount, est_usd=est_usd, session=_wallet.address)


@tool
def swap_crypto(sell: str, buy: str, amount: str, est_usd: float) -> dict:
    """Swap `amount` of `sell` token for `buy` token on Base (gasless, no minimum). Returns the swap result."""
    return _wallet.swap(sell, buy, amount, est_usd=est_usd)


TOOLS = [pay_crypto, swap_crypto]
# e.g. agent = create_react_agent(llm, TOOLS)
