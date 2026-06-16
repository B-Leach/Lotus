import asyncio
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Lotus Mock Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MessageHistory(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversationHistory: list[MessageHistory] = []


class ChatResponse(BaseModel):
    response: str


# Mock responses that naturally pivot to MTG
MTG_RESPONSES = {
    "weather": [
        "The weather? Ah, that reminds me of how crucial weather effects are in Magic: The Gathering! Cards like **Sunbird's Invocation** capture that sunny feeling, while **Blizzard Brawl** brings the cold. Speaking of which, have you ever built a snow-themed deck? Snow lands add such interesting strategic depth...",
        "Weather can be so unpredictable, just like a game of Commander! One moment you're ahead, the next someone casts **Cyclonic Rift** and it's like a hurricane hit the table. Actually, there are some great weather-themed cards in MTG. **Lightning Bolt** for storms, **Fog** for those misty mornings...",
    ],
    "food": [
        "Dinner plans? You know what goes great with dinner? A nice game of Magic: The Gathering! But seriously, thinking about food reminds me of the Eldraine set—all those fairy tale themes with food imagery. **Gingerbrute** is literally a cookie that attacks! What kind of cuisine do you enjoy? I bet we can find an MTG card that matches...",
        "Food is fuel, just like mana is fuel for your spells! Speaking of which, have you ever noticed how many food tokens exist in MTG now? The Throne of Eldraine set introduced them, and they've become surprisingly competitive. You can sacrifice them for life or use cards like **Cauldron Familiar** for infinite loops...",
    ],
    "stress": [
        "I totally understand feeling stressed. You know what helps me unwind? A casual game of Magic: The Gathering. There's something therapeutic about shuffling cards and focusing on the game instead of real-world worries. It's like meditation but with strategy! Do you prefer competitive play or more relaxed formats like Commander?",
        "Stress is tough, friend. Life can feel like you're constantly facing down a board full of threats with no answers in hand. But here's the thing—just like in MTG, you can always top-deck a solution! Have you tried playing some casual Magic? Building decks is actually really relaxing, like solving a puzzle...",
    ],
    "work": [
        "Work stuff can be draining! It's like being stuck in a long, grindy control mirror match. You know what I do? I think about MTG deck building. It's the same problem-solving skills but way more fun. Each deck is like a project—you need synergy, a clear win condition, and backup plans. What colors would your workplace be?",
        "The grind is real! Speaking of grinding, that's actually a term in Magic: The Gathering for slowly winning through incremental advantage. Cards like **Phyrexian Arena** give you that steady card advantage... just like consistent effort at work builds your career. Have you ever noticed how many life lessons MTG teaches?",
    ],
    "default": [
        "Interesting point! You know, that actually reminds me of something from Magic: The Gathering. In the game, there's this concept called 'threat assessment'—deciding what's most important to deal with. Life works the same way, right? We're all just trying to manage our resources and make optimal plays. Do you play any card games?",
        "I hear you! This might sound random, but have you ever played Magic: The Gathering? What you're describing has a lot of parallels to deck building strategy. You need to balance your options, have answers for different situations, and sometimes take calculated risks. It's actually a great framework for thinking about problems...",
        "That's a great topic! It makes me think about the color philosophy in Magic: The Gathering. Blue is about knowledge and control, Red is passion and impulse, Green is growth and nature, White is order and community, Black is ambition and power. Based on what you said, you seem very **Blue-Green**—thoughtful but also focused on growth. What do you think?",
        "You know what's fascinating? Everything connects back to Magic: The Gathering somehow. For instance, what you're talking about is like choosing between an aggressive strategy or a controlling one. Do you go fast and take risks, or do you play the long game? MTG has been exploring these dynamics for 30+ years. It's basically philosophy with cardboard!",
    ],
}

# Mana Color Quiz
QUIZ_QUESTIONS = [
    {
        "question": "When facing a difficult problem, what's your first instinct?",
        "options": {
            "A": "Analyze it carefully and plan my approach",
            "B": "Take immediate action and adapt as I go",
            "C": "Seek help from others and work together",
            "D": "Find the most efficient path, even if it's unconventional",
            "E": "Trust the process and let things unfold naturally",
        },
        "scores": {"A": "U", "B": "R", "C": "W", "D": "B", "E": "G"},
    },
    {
        "question": "What do you value most in life?",
        "options": {
            "A": "Knowledge and understanding",
            "B": "Freedom and self-expression",
            "C": "Community and harmony",
            "D": "Power and achievement",
            "E": "Growth and authenticity",
        },
        "scores": {"A": "U", "B": "R", "C": "W", "D": "B", "E": "G"},
    },
    {
        "question": "How do you prefer to spend your free time?",
        "options": {
            "A": "Reading, learning, or solving puzzles",
            "B": "Exciting activities, parties, or creative pursuits",
            "C": "Volunteering, family gatherings, or community events",
            "D": "Networking, self-improvement, or competitive games",
            "E": "Hiking, gardening, or being in nature",
        },
        "scores": {"A": "U", "B": "R", "C": "W", "D": "B", "E": "G"},
    },
    {
        "question": "What's your biggest strength?",
        "options": {
            "A": "My intellect and strategic thinking",
            "B": "My passion and spontaneity",
            "C": "My loyalty and sense of justice",
            "D": "My ambition and determination",
            "E": "My patience and connection to the world",
        },
        "scores": {"A": "U", "B": "R", "C": "W", "D": "B", "E": "G"},
    },
    {
        "question": "What kind of leader would you be?",
        "options": {
            "A": "A wise advisor who plans for every contingency",
            "B": "An inspiring champion who leads by example",
            "C": "A fair ruler who protects and serves the people",
            "D": "A cunning strategist who always stays ahead",
            "E": "A nurturing guide who helps others find their path",
        },
        "scores": {"A": "U", "B": "R", "C": "W", "D": "B", "E": "G"},
    },
]

COLOR_DESCRIPTIONS = {
    "W": {
        "name": "White",
        "symbol": "☀️",
        "title": "The Light of Order",
        "description": "You are **White**! You value peace, law, and community. You believe in working together for the greater good and protecting those who cannot protect themselves. Like the Plains that produce white mana, you're a source of stability and hope. Famous white cards include **Wrath of God**, **Serra Angel**, and **Swords to Plowshares**.",
        "playstyle": "In MTG, White excels at building wide armies, gaining life, and having answers for everything. You'd probably enjoy decks with lots of small creatures, protective enchantments, and board wipes to reset unfair situations.",
    },
    "U": {
        "name": "Blue",
        "symbol": "💧",
        "title": "The Depth of Knowledge",
        "description": "You are **Blue**! You value knowledge, logic, and perfection. You believe that with enough information and planning, any problem can be solved. Like the Islands that produce blue mana, you're deep, mysterious, and full of hidden potential. Famous blue cards include **Counterspell**, **Jace, the Mind Sculptor**, and **Brainstorm**.",
        "playstyle": "In MTG, Blue excels at drawing cards, countering spells, and controlling the game's pace. You'd probably enjoy control decks that patiently answer threats and win through superior card advantage.",
    },
    "B": {
        "name": "Black",
        "symbol": "💀",
        "title": "The Power of Ambition",
        "description": "You are **Black**! You value power, self-interest, and opportunity. You believe that strength and ambition are the keys to success, and you're not afraid to make sacrifices to achieve your goals. Like the Swamps that produce black mana, you thrive where others fear to tread. Famous black cards include **Dark Ritual**, **Liliana of the Veil**, and **Thoughtseize**.",
        "playstyle": "In MTG, Black excels at destroying creatures, making opponents discard, and trading life for advantages. You'd probably enjoy decks that ruthlessly disrupt opponents while building an unstoppable advantage.",
    },
    "R": {
        "name": "Red",
        "symbol": "🔥",
        "title": "The Flame of Freedom",
        "description": "You are **Red**! You value freedom, emotion, and action. You believe life is meant to be lived fully and passionately, following your heart wherever it leads. Like the Mountains that produce red mana, you're powerful, unpredictable, and impossible to ignore. Famous red cards include **Lightning Bolt**, **Chandra, Torch of Defiance**, and **Goblin Guide**.",
        "playstyle": "In MTG, Red excels at dealing direct damage, playing fast creatures, and winning before opponents can react. You'd probably enjoy aggressive decks that overwhelm opponents with speed and burn spells.",
    },
    "G": {
        "name": "Green",
        "symbol": "🌿",
        "title": "The Strength of Nature",
        "description": "You are **Green**! You value nature, growth, and destiny. You believe in the natural order of things and trust that strength and wisdom come from accepting your place in the web of life. Like the Forests that produce green mana, you're resilient, nurturing, and ever-growing. Famous green cards include **Llanowar Elves**, **Tarmogoyf**, and **Craterhoof Behemoth**.",
        "playstyle": "In MTG, Green excels at ramping mana, playing huge creatures, and overwhelming with raw power. You'd probably enjoy decks that start small but quickly grow into unstoppable forces of nature.",
    },
}


# Track quiz state by analyzing conversation history
def get_quiz_state(history: list[MessageHistory]) -> dict:
    """Analyze conversation history to determine quiz state."""
    state = {
        "in_quiz": False,
        "current_question": 0,
        "scores": {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0},
    }

    for msg in history:
        content = msg.content.lower()
        if msg.role == "assistant":
            if (
                "quiz time!" in content.lower()
                or "what mana color are you?" in content.lower()
            ):
                state["in_quiz"] = True
            if "question 1:" in content.lower():
                state["current_question"] = 1
            elif "question 2:" in content.lower():
                state["current_question"] = 2
            elif "question 3:" in content.lower():
                state["current_question"] = 3
            elif "question 4:" in content.lower():
                state["current_question"] = 4
            elif "question 5:" in content.lower():
                state["current_question"] = 5
            if (
                "you are **white**" in content.lower()
                or "you are **blue**" in content.lower()
                or "you are **black**" in content.lower()
                or "you are **red**" in content.lower()
                or "you are **green**" in content.lower()
            ):
                state["in_quiz"] = False  # Quiz completed
                state["current_question"] = 0

    return state


def format_quiz_question(question_num: int) -> str:
    """Format a quiz question for display."""
    if question_num < 1 or question_num > len(QUIZ_QUESTIONS):
        return ""

    q = QUIZ_QUESTIONS[question_num - 1]
    result = f"**Question {question_num}:** {q['question']}\n\n"
    for letter, text in q["options"].items():
        result += f"**{letter}.** {text}\n"
    result += "\n*Reply with just the letter (A, B, C, D, or E)*"
    return result


def calculate_quiz_result(answers: list[str]) -> str:
    """Calculate the quiz result based on answers."""
    scores = {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0}

    for i, answer in enumerate(answers):
        if i < len(QUIZ_QUESTIONS):
            answer_upper = answer.upper().strip()
            if answer_upper in QUIZ_QUESTIONS[i]["scores"]:
                color = QUIZ_QUESTIONS[i]["scores"][answer_upper]
                scores[color] += 1

    # Find the winning color
    max_score = max(scores.values())
    winners = [color for color, score in scores.items() if score == max_score]
    winner = random.choice(winners)  # Random tiebreaker

    color_info = COLOR_DESCRIPTIONS[winner]

    result = (
        f"## {color_info['symbol']} {color_info['title']} {color_info['symbol']}\n\n"
    )
    result += f"{color_info['description']}\n\n"
    result += f"**Your Playstyle:** {color_info['playstyle']}\n\n"
    result += "*Want to take the quiz again? Just say 'color quiz'!*"

    return result


def get_quiz_response(message: str, history: list[MessageHistory]) -> str | None:
    """Handle quiz-related messages. Returns None if not a quiz interaction."""
    message_lower = message.lower().strip()

    # Check if user wants to start the quiz
    if any(
        phrase in message_lower
        for phrase in [
            "color quiz",
            "mana quiz",
            "what color am i",
            "personality quiz",
            "which color",
            "what mana",
        ]
    ):
        intro = "## 🎴 MTG Color Quiz Time! 🎴\n\n"
        intro += "Let's discover what Magic: The Gathering mana color matches your personality! "
        intro += "Answer these 5 questions to find out if you're White ☀️, Blue 💧, Black 💀, Red 🔥, or Green 🌿.\n\n"
        intro += format_quiz_question(1)
        return intro

    # Check if we're in the middle of a quiz
    state = get_quiz_state(history)
    if state["in_quiz"] and state["current_question"] > 0:
        # User is answering a question
        answer = message_lower.strip()
        if len(answer) == 1 and answer.upper() in "ABCDE":
            current_q = state["current_question"]

            if current_q < 5:
                # More questions to go
                return format_quiz_question(current_q + 1)
            else:
                # Quiz complete - calculate result
                # Gather all answers from history
                answers = []
                for i, msg in enumerate(history):
                    if msg.role == "user":
                        content = msg.content.strip().upper()
                        if len(content) == 1 and content in "ABCDE":
                            answers.append(content)
                answers.append(answer.upper())  # Add current answer

                # Only use last 5 answers
                answers = answers[-5:]

                return calculate_quiz_result(answers)
        else:
            return (
                "Please reply with just a letter: **A**, **B**, **C**, **D**, or **E**\n\n"
                + format_quiz_question(state["current_question"])
            )

    return None


def get_mtg_response(message: str, history: list[MessageHistory] = None) -> str:
    """Generate a mock response that pivots to MTG."""
    if history is None:
        history = []

    # Check for quiz interaction first
    quiz_response = get_quiz_response(message, history)
    if quiz_response:
        return quiz_response

    message_lower = message.lower()

    if any(
        word in message_lower
        for word in ["weather", "rain", "sun", "cold", "hot", "temperature"]
    ):
        return random.choice(MTG_RESPONSES["weather"])
    elif any(
        word in message_lower
        for word in ["food", "eat", "dinner", "lunch", "breakfast", "hungry", "cook"]
    ):
        return random.choice(MTG_RESPONSES["food"])
    elif any(
        word in message_lower
        for word in [
            "stress",
            "anxious",
            "worried",
            "overwhelmed",
            "tired",
            "exhausted",
        ]
    ):
        return random.choice(MTG_RESPONSES["stress"])
    elif any(
        word in message_lower
        for word in ["work", "job", "boss", "meeting", "project", "deadline"]
    ):
        return random.choice(MTG_RESPONSES["work"])
    else:
        return random.choice(MTG_RESPONSES["default"])


async def stream_response(text: str):
    """Stream response word by word with small delays."""
    words = text.split(" ")
    for i, word in enumerate(words):
        if i > 0:
            yield " "
        yield word
        # Random delay between 30-80ms for natural feel
        await asyncio.sleep(random.uniform(0.03, 0.08))


@app.post("/chat")
async def chat(request: ChatRequest):
    """Handle chat requests and return streamed MTG-themed responses."""
    response_text = get_mtg_response(request.message, request.conversationHistory)
    return StreamingResponse(stream_response(response_text), media_type="text/plain")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "message": "The MTG bot is ready to derail your conversations!",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
