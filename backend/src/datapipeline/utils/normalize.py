import re

import unicodedata



_WS = re.compile(r"\s+")

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)



def normalize_key(s: str | None) -> str | None:

    """

    Strict-safe normalizer: lowercased, accents removed, punctuation stripped,

    whitespace collapsed. Returns None if empty after normalization.

    """

    if s is None:

        return None

    s = str(s).strip()

    if not s:

        return None

    # Unicode NFKD, remove diacritics

    s = unicodedata.normalize("NFKD", s)

    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    # Lowercase

    s = s.lower()

    # Remove punctuation

    s = _PUNCT.sub(" ", s)

    # Collapse whitespace

    s = _WS.sub(" ", s).strip()

    return s or None

