import sys
from pathlib import Path

# Tests import the agents the way server.py does: from this folder.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
