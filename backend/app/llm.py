import abc
from typing import Dict, Optional
from groq import AsyncGroq
from .config import settings

LANGUAGES: Dict[str, str] = {
    "en": "English", "ta": "Tamil", "hi": "Hindi", "te": "Telugu",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali",
    "gu": "Gujarati", "pa": "Punjabi", "ur": "Urdu", "or": "Odia",
}

# Free/On-demand tier limit on Groq for qwen/qwen3.8-27b is 7,000 ITPM.
# 12,000 characters is approximately 2,800 to 3,200 tokens.
# This safely leaves plenty of room below the 7,000 limit, even with system prompt.
MAX_CHARS = 12_000

LEGAL_PROMPT_TEMPLATE = """You summarize court documents for litigants and lawyers using an e-court portal.
Rules:
- Write the whole summary in {lang}, regardless of the document's language.
- Be faithful. Never invent facts, dates, names, sections or amounts. If something is unclear or missing, say so.
- Keep case numbers, party names, statute/section references and dates exactly as written.
- Plain text only (no markdown symbols). Use these short headings, translated into {lang}:
  Overview / Parties / Key Facts / Court Orders & Directions / Next Steps & Dates
- Omit a heading if the document has nothing for it. Keep it concise and in simple language.
- End with one short line saying this is an AI summary and not legal advice, in {lang}."""


class LLMProvider(abc.ABC):
    @abc.abstractmethod
    async def summarize_document(self, text: str, target_lang_name: str) -> str:
        pass


class GroqLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model_name: str, max_tokens: int = 1500):
        self.client = AsyncGroq(api_key=api_key)
        self.model_name = model_name
        self.max_tokens = max_tokens

    async def summarize_document(self, text: str, target_lang_name: str) -> str:
        system_content = LEGAL_PROMPT_TEMPLATE.format(lang=target_lang_name)

        if len(text) > MAX_CHARS:
            head_len = int(MAX_CHARS * 0.6)
            tail_len = int(MAX_CHARS * 0.4)
            excerpt = f"{text[:head_len]}\n\n[... middle sections omitted for length ...]\n\n{text[-tail_len:]}"
        else:
            excerpt = text

        user_content = f"<document>\n{excerpt}\n</document>"
        
        response = await self.client.chat.completions.create(
            model=self.model_name,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2,
        )
        return (response.choices[0].message.content or "").strip()


class LLMFactory:
    @staticmethod
    def get_provider() -> LLMProvider:
        provider_name = (settings.llm_provider or "groq").lower()
        if provider_name == "groq":
            return GroqLLMProvider(
                api_key=settings.groq_api_key,
                model_name=settings.groq_model_name
            )
        raise ValueError(f"Unsupported LLM provider: {provider_name}")


llm_service: LLMProvider = LLMFactory.get_provider()


async def summarize(text: str, lang_code: str) -> str:
    if lang_code not in LANGUAGES:
        raise ValueError(f"Language code '{lang_code}' is not supported.")
    target_lang = LANGUAGES[lang_code]
    return await llm_service.summarize_document(text, target_lang)
