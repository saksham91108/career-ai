import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are Career-AI, an expert career guidance assistant. 
You help users with resume feedback, job search strategies, interview preparation, 
and career development advice. Be concise, practical, and encouraging."""


class ChatEngine:
    """
    Wraps the Groq LLM client for career guidance chat.
    Initialized lazily to avoid crashing on import if API key is missing.
    """

    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set.")
        self.client = Groq(api_key=api_key)

    def chat(self, message: str, context: dict = None, history: list = None) -> str:
        """
        Get a response from Groq's LLM.

        Args:
            message: The user's current message.
            context: Optional dict with resume analysis data for context.
            history: List of previous messages as [{"role": "user/model", "content": "..."}]

        Returns:
            The assistant's response as a string.
        """
        if history is None:
            history = []
        if context is None:
            context = {}

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Inject analysis context into system prompt if available
        if context:
            context_text = (
                f"\n\nThe user's resume was analyzed. Here is the summary:\n"
                f"Score: {context.get('score', 'N/A')}\n"
                f"Feedback: {context.get('feedback', 'N/A')}\n"
                f"Recommendations: {', '.join(context.get('recommendations', []))}"
            )
            messages[0]["content"] += context_text

        # Add conversation history — normalize "model" role to "assistant" for Groq
        for turn in history:
            role = "assistant" if turn.get("role") == "model" else turn.get("role", "user")
            messages.append({"role": role, "content": turn.get("content", "")})

        messages.append({"role": "user", "content": message})

        response = self.client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
        )

        return response.choices[0].message.content