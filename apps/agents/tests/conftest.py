import os
import sys
from pathlib import Path

# Same as server.py: one OpenMP runtime per process (see the note there). Before numpy is imported.
os.environ.setdefault("MKL_THREADING_LAYER", "SEQUENTIAL")

# Tests import the agents the way server.py does: from this folder.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
