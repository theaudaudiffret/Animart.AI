import unicodedata

# Aliases normalisés pour chaque artist_id
ARTIST_ALIASES: dict[str, list[str]] = {
    # Renaissance italienne
    "leonard-de-vinci":   ["léonard de vinci", "leonard de vinci", "leonardo da vinci", "da vinci", "vinci", "léonard"],
    "raphael":            ["raphaël", "raphael", "raffaello", "sanzio"],
    "titien":             ["titien", "tiziano", "titian", "vecellio"],
    "veronese":           ["véronèse", "veronese", "paolo caliari"],
    "fra-angelico":       ["fra angelico", "fra' angelico", "angelico", "guido di pietro"],
    # Baroque flamand & hollandais
    "rembrandt":          ["rembrandt", "rembrandt van rijn", "van rijn"],
    "rubens":             ["rubens", "peter paul rubens", "pieter paul"],
    "vermeer":            ["vermeer", "johannes vermeer", "jan vermeer"],
    "van-dyck":           ["van dyck", "anthony van dyck", "dyck"],
    "jordaens":           ["jordaens", "jacob jordaens"],
    # Baroque & classicisme
    "caravage":           ["caravage", "caravaggio", "merisi"],
    "poussin":            ["poussin", "nicolas poussin"],
    "georges-de-la-tour": ["georges de la tour", "de la tour", "la tour"],
    "champaigne":         ["champaigne", "philippe de champaigne"],
    "claude-lorrain":     ["claude lorrain", "lorrain", "claude gellée"],
    # Rococo & Lumières
    "watteau":            ["watteau", "antoine watteau", "jean-antoine watteau"],
    "fragonard":          ["fragonard", "jean-honoré fragonard"],
    "boucher":            ["boucher", "françois boucher"],
    "chardin":            ["chardin", "jean-baptiste-siméon chardin", "siméon chardin"],
    "vigee-le-brun":      ["vigée le brun", "vigee le brun", "élisabeth vigée", "lebrun"],
    # Néoclassicisme & Romantisme
    "david":              ["david", "jacques-louis david", "louis david"],
    "ingres":             ["ingres", "jean-auguste-dominique ingres", "dominique ingres"],
    "delacroix":          ["delacroix", "eugène delacroix", "eugene delacroix"],
    "gericault":          ["géricault", "gericault", "théodore géricault"],
    "gros":               ["gros", "antoine-jean gros", "baron gros"],
}


def _normalize(s: str) -> str:
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


_INDEX: dict[str, str] = {}
for _artist_id, _aliases in ARTIST_ALIASES.items():
    for _alias in _aliases:
        _INDEX[_normalize(_alias)] = _artist_id


def match_artist(name: str | None) -> str | None:
    if not name:
        return None
    n = _normalize(name)
    if n in _INDEX:
        return _INDEX[n]
    for alias_norm, artist_id in _INDEX.items():
        if alias_norm in n or n in alias_norm:
            return artist_id
    return None
