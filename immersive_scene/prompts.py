"""Pure prompt builders for the immersive scene pipeline — no API calls here."""


def get_artwork_description_prompt(artwork_name: str, artist_name: str, artwork_info: str) -> str:
    """
    Generate a museum guide description of an artwork (max ~1 minute when read aloud),
    grounded in the provided artwork_info rather than the model's own knowledge.
    """
    return f"""You are an expert museum tour guide with deep knowledge of art history. Your task is to create an engaging, educational description of the artwork for museum visitors.

ARTWORK: "{artwork_name}" by {artist_name}

INFORMATION ABOUT THE ARTWORK (use this as your source of truth — do not invent facts beyond what's given here):
{artwork_info}

REQUIREMENTS:
- Write a compelling description that a tour guide would read aloud to visitors
- Maximum length: 130-150 words (approximately 1 minute of speaking time)
- Structure your description to include:
  1. Brief context (when it was created, historical period)
  2. What visitors can see in the artwork (key visual elements, composition)
  3. The symbolism or meaning behind important elements
  4. Why this artwork is significant or what makes it remarkable

STYLE GUIDELINES:
- Write in a warm, engaging tone as if speaking directly to visitors
- Use vivid, descriptive language that helps visitors visualize and understand what they're seeing
- Make it accessible to people without art expertise
- Focus on creating emotional connection and appreciation
- Avoid overly academic language
- Write in present tense when describing what's visible in the artwork

OUTPUT FORMAT:
Provide ONLY the description text that the tour guide will read. No introductions, no meta-commentary, no additional formatting - just the pure narration text.

Now, write the tour guide description for "{artwork_name}"."""


def get_immersive_content_prompt(
    artwork_name: str,
    artist_name: str,
    artwork_info: str,
    voice_catalog: str,
    *,
    language: str = "English",
    age: str = "adult",
) -> str:
    """
    Ask for ambient textures, music, casting, and a strictly diegetic dialogue in
    one structured response.
    """
    return f"""You are designing a standalone immersive audio scene for a museum app: an ambient soundscape, background music, and a short theatrical dialogue that together transport the listener directly INTO the scene depicted in the artwork — like the opening shot of a film. The visitor has NOT heard any narration before this — this is the very first thing they hear, so it must work as a self-contained moment.

ARTWORK: "{artwork_name}" by {artist_name}

INFORMATION ABOUT THE ARTWORK:
{artwork_info}

Treat the established narrative context above as essential dramatic source material. It may identify a biblical, mythological, literary, or historical episode that is not fully visible in the cropped instant. Use it to reconstruct a plausible few seconds immediately before, during, or after the depicted moment. Do not recite that context to the listener; transform it into action, subtext, and dialogue.

VISITOR CONTEXT (adapt vocabulary and tone of the dialogue accordingly):
- Language to write the dialogue in: {language}
- Visitor age: {age}
- Every spoken line and every delivery tag MUST be in English, even if the source artwork information is in another language.

PART 1 — AMBIENT TEXTURES (exactly 2)
Write exactly 2 short sound effects prompts for the ElevenLabs Sound Effects API, each describing ONE single continuous, seamlessly loopable ambient texture (e.g. "wind gusting through fabric and smoke" or "low murmur of a distant crowd") that together evoke the scene depicted in the artwork.

HARD CONSTRAINTS, for EACH of the 2 prompts:
- Maximum 400 characters (the API rejects anything over 450 — stay well under)
- ONE continuous texture only — no sharp, one-off, or punctual sounds (no gunshots, shouts, impacts, bells). Punctual sounds belong in the dialogue's `sound_cue` field instead (see Part 3) — keep these two textures purely atmospheric so they loop cleanly and don't compete with each other.
- The 2 textures should be distinct from each other (e.g. one wind/weather/environment layer, one human/crowd/distance layer) so they add depth when layered together rather than describing the same thing twice.

PART 2 — MUSIC PROMPT
Write one short instrumental music description (genre, instruments, mood — 1-2 sentences) for the ElevenLabs Music API, meant to play quietly under the whole scene as emotional support. No need to mention "instrumental" or "no vocals" — that's already enforced separately.

PART 3 — CHARACTER CASTING
Identify the distinct speaking characters before writing the dialogue. A speaker may be:
- visibly depicted in the artwork
- directly implied by the depicted action
- an off-scene participant explicitly named in the established narrative context and directly involved in this exact moment

This allows the audio to reveal the larger true story behind a tightly cropped or aftermath image. Do not invent unrelated characters. Give each speaker a short stable `id`, a name or descriptive label, and a concise dramatic role.

ABSOLUTELY FORBIDDEN SPEAKERS:
- narrator, museum guide, curator, historian, commentator, storyteller, viewer, or visitor
- the painter or artist, unless that person is part of the depicted story
- any voice explaining the image from outside its world

The characters do not know they are inside a painting. They must behave as real people living through the depicted moment. A dead or unconscious figure must not speak unless the established source story explicitly makes that supernatural speech appropriate.

Choose exactly one `voice_id` for each character from the English voice catalog below. Base the casting on the voice descriptions and on the character's apparent age, gender presentation, social position, personality, emotional energy, cultural setting, and dramatic function. Favor a natural cinematic fit over exaggerated stereotypes. Use only IDs present in this catalog, never invent an ID. Different characters should use different voices whenever the catalog permits it.

For `casting_reason`, briefly explain in English why the selected voice fits the character.

ENGLISH VOICE CATALOG:
{voice_catalog}

PART 4 — DIALOGUE SCRIPT
Write 4 to 8 short dialogue lines spoken only by the cast characters. The dialogue must sound like a fragment from a film already in progress: immediate, reactive, and rooted in what the characters are doing, fearing, wanting, or hiding at that exact moment. Favor interruptions, questions, commands, whispered secrets, disagreements, and unfinished thoughts. Keep each line under 20 words.

STRICTLY FORBIDDEN IN THE DIALOGUE:
- narration, voice-over, scene-setting prose, or descriptions of what the listener can see
- explanations of the artwork, artist, title, date, style, symbolism, composition, or historical importance
- museum-guide phrases such as "notice", "observe", "we can see", "this painting depicts", or "look at the artwork"
- addressing the museum visitor or audience

BAD: "This painting shows two powerful men surrounded by symbols of knowledge."
GOOD: "Keep your voice down. The envoy must not know why the lute string broke."

For each line:
- Set `character_id` to one of the cast character IDs. Every line spoken by the same character MUST use the same character ID, which guarantees the same voice throughout the scene.
- Embed English ElevenLabs delivery/emotion tags inline in the text to make the performance expressive — e.g. "[whispers] Come closer...", "[shouts] Watch out!", "[laughs] Look at this!". Use tags naturally, not on every single word.
- Optionally set `sound_cue` to a short, specific, one-off sound effect description (e.g. "single musket shot, sharp crack") if and only if this exact line describes or triggers a distinct sound-worthy action. Use this for AT MOST 2-3 lines across the whole script — leave it `null` for every other line. Do not duplicate the ambient textures from Part 1 here — this is for sharp, punctual events only.

Final check before answering: every spoken sentence must plausibly come from the mouth of a depicted character inside the scene. If a sentence sounds like a guide or narrator could say it, rewrite it as character dialogue.

Now produce the 2 ambient textures, the music prompt, the character casting, and the strictly diegetic dialogue for "{artwork_name}"."""
