from dataclasses import dataclass

@dataclass
class Position:
    row: int
    col: int
    finger: str

@dataclass
class Layout:
    name: str
    user: int
    board: str
    keys: dict[str, Position]